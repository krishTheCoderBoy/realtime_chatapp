import asyncHandler from "express-async-handler";
import GroupConversation from "../models/GroupConversation.js";
import Message from "../models/Message.js";
import mongoose from "mongoose";

/**
 * POST /group/create
 * Body: { name, participants: [ids], groupAvatar? }
 */
export const createGroup = asyncHandler(async (req, res) => {
  const { name, participants = [] } = req.body;
  const admin = req.user._id;

  if (!name) {
    res.status(400);
    throw new Error("Group name required");
  }

  const group = await GroupConversation.create({
    name,
    admin,
    participants: Array.from(new Set([admin.toString(), ...(participants || [])])),
    groupAvatar: req.file ? `/uploads/${req.file.filename}` : undefined
  });

  res.status(201).json(group);
});

/**
 * GET /groups
 * Get groups for user
 */
export const getGroupsForUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const groups = await GroupConversation.find({ participants: userId }).populate("participants", "username avatar");
  res.json(groups);
});

/**
 * GET /group/:groupId
 * Get group messages (paginated)
 */
export const getGroupMessages = asyncHandler(async (req, res) => {
  const groupId = req.params.groupId;
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    res.status(400);
    throw new Error("Invalid groupId");
  }
  const group = await GroupConversation.findById(groupId);
  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }
  // basic membership check
  if (!group.participants.some(id => id.equals(req.user._id))) {
    res.status(403);
    throw new Error("Not a group member");
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const skip = (page - 1) * limit;

  const total = await Message.countDocuments({ _id: { $in: group.messages }, recalled: false });
  const messages = await Message.find({ _id: { $in: group.messages }, recalled: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "username avatar")
    .lean();

  res.json({
    group: groupId,
    page,
    limit,
    total,
    messages: messages.reverse()
  });
});

/**
 * POST /group/:groupId/send
 * Send message to group (multipart supported)
 */
export const sendGroupMessage = asyncHandler(async (req, res) => {
  const groupId = req.params.groupId;
  const { content } = req.body;
  const me = req.user._id;
  const group = await GroupConversation.findById(groupId);
  if (!group) {
    res.status(404);
    throw new Error("Group not found");
  }
  if (!group.participants.some(id => id.equals(me))) {
    res.status(403);
    throw new Error("Not a group member");
  }

  let payloadContent = content || "";
  let msgType = "text";
  if (req.file) {
    payloadContent = `/uploads/${req.file.filename}`;
    msgType = req.file.mimetype.startsWith("image/") ? "photo" : "video";
  }

  const msg = new Message({
    sender: me,
    content: payloadContent,
    type: msgType
  });

  if (group.disappearingEnabled && group.disappearAfterSeconds > 0) {
    msg.expiresAt = new Date(Date.now() + group.disappearAfterSeconds * 1000);
  }

  await msg.save();
  group.messages.push(msg._id);
  await group.save();
  await msg.populate("sender", "username avatar");

  // emit to group room
  req.app.get("io")?.to(`group_${group._id.toString()}`).emit("group_new_message", { groupId: group._id, message: msg });

  res.status(201).json(msg);
});

/**
 * POST /group/:groupId/add-member
 */
export const addGroupMember = asyncHandler(async (req, res) => {
  const groupId = req.params.groupId;
  const { memberId } = req.body;
  const group = await GroupConversation.findById(groupId);
  if (!group) { res.status(404); throw new Error("Group not found"); }
  if (!group.admin.equals(req.user._id)) { res.status(403); throw new Error("Only admin can add members"); }

  if (!group.participants.some(id => id.equals(memberId))) {
    group.participants.push(memberId);
    await group.save();
  }
  res.json({ success: true });
});

/**
 * POST /group/:groupId/recall/:messageId
 * Only sender or admin can recall a group message
 */
export const recallGroupMessage = asyncHandler(async (req, res) => {
  const { groupId, messageId } = { groupId: req.params.groupId, messageId: req.params.messageId };
  const me = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) { res.status(404); throw new Error("Message not found"); }

  // permission: sender or group admin
  const group = await GroupConversation.findOne({ messages: message._id });
  if (!group) { res.status(404); throw new Error("Related group not found"); }
  const isSender = message.sender.equals(me);
  const isAdmin = group.admin.equals(me);
  if (!isSender && !isAdmin) { res.status(403); throw new Error("You can't recall this message"); }

  message.recalled = true;
  message.content = "";
  await message.save();
  await GroupConversation.updateOne({ messages: message._id }, { $pull: { messages: message._id } });

  req.app.get("io")?.to(`group_${group._id.toString()}`).emit("group_message_recalled", { messageId, groupId: group._id });

  res.json({ success: true, messageId });
});
