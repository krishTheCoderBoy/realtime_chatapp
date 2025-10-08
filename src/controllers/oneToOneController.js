import asyncHandler from "express-async-handler";
import OneToOneConversation from "../models/OneToOneConversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import mongoose from "mongoose";

/**
 * GET /conversations
 * Get list of one-to-one conversations for logged-in user (with last message)
 */
export const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  // Find conversations where user is participant and populate last message
  const convs = await OneToOneConversation.find({ participants: userId })
    .populate({
      path: "messages",
      options: { sort: { createdAt: -1 }, limit: 1 },
      populate: { path: "sender", select: "username avatar" }
    })
    .populate("participants", "username avatar email")
    .sort({ updatedAt: -1 })
    .exec();

  res.json(convs);
});

/**
 * GET /conversation/:userId
 * Get messages between logged-in user and userId (creates conversation if not exists)
 * Query: ?page=1&limit=40
 */
export const getOrCreateConversationMessages = asyncHandler(async (req, res) => {
  const otherUserId = req.params.userId;
  const me = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    res.status(400);
    throw new Error("Invalid userId");
  }
  // find conversation with both participants
  let conv = await OneToOneConversation.findOne({ participants: { $all: [me, otherUserId], $size: 2 } })
    .populate("participants", "username avatar");

  if (!conv) {
    conv = await OneToOneConversation.create({ participants: [me, otherUserId] });
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 50);
  const skip = (page - 1) * limit;

  const total = await Message.countDocuments({ _id: { $in: conv.messages }, recalled: false });
  const messages = await Message.find({ _id: { $in: conv.messages }, recalled: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("sender", "username avatar")
    .lean();

  res.json({
    conversation: conv._id,
    participants: conv.participants,
    page,
    limit,
    total,
    messages: messages.reverse() // return chronological order
  });
});

/**
 * POST /conversation/:userId
 * Send message to other user. Body: { content, type } OR multipart form file (photo/video)
 * This controller handles storing message, adding to conv, setting expiresAt if disappearing enabled
 */
export const sendMessageToUser = asyncHandler(async (req, res) => {
  const otherUserId = req.params.userId;
  const me = req.user._id;
  const { content, type } = req.body;
  let payloadContent = content || "";

  // find conversation
  let conv = await OneToOneConversation.findOne({ participants: { $all: [me, otherUserId], $size: 2 } });
  if (!conv) {
    conv = await OneToOneConversation.create({ participants: [me, otherUserId] });
  }

  // file upload (multer) -> file path accessible at req.file
  if (req.file) {
    // in production, you might upload to cloud (Cloudinary/S3). Here we store local path
    payloadContent = `/uploads/${req.file.filename}`;
  }

  const msg = new Message({
    sender: me,
    content: payloadContent,
    type: type || (req.file ? (req.file.mimetype.startsWith("image/") ? "photo" : "video") : "text"),
  });

  // If disappearing is enabled on conv, set expiresAt
  if (conv.disappearingEnabled && conv.disappearAfterSeconds > 0) {
    msg.expiresAt = new Date(Date.now() + conv.disappearAfterSeconds * 1000);
  }

  await msg.save();
  conv.messages.push(msg._id);
  await conv.save();

  // populate for response
  await msg.populate("sender", "username avatar");

  // emit via socket (socket logic in sockets/index.js will broadcast)
  req.app.get("io")?.to(conv._id.toString()).emit("one_to_one_new_message", { conversationId: conv._id, message: msg });

  res.status(201).json(msg);
});

/**
 * POST /conversation/:userId/recall/:messageId
 * Recall a message (soft recall)
 */
export const recallMessage = asyncHandler(async (req, res) => {
  const { userId, messageId } = { userId: req.params.userId, messageId: req.params.messageId };
  const me = req.user._id;

  const message = await Message.findById(messageId);
  if (!message) {
    res.status(404);
    throw new Error("Message not found");
  }
  if (!message.sender.equals(me)) {
    res.status(403);
    throw new Error("You can only recall your own messages");
  }

  // soft recall: mark recalled and clear content
  message.recalled = true;
  message.content = ""; // optional
  await message.save();

  // remove message ref from conversation (keep record for history or you may keep it)
  await OneToOneConversation.updateOne({ messages: message._id }, { $pull: { messages: message._id } });

  // notify via socket
  req.app.get("io")?.emit("one_to_one_message_recalled", { messageId, conversationId: req.params.userId });

  res.json({ success: true, messageId });
});

/**
 * POST /conversation/:userId/disappearing
 * Enable/Disable disappearing messages for this conversation
 * Body: { enabled: boolean, seconds: number }
 */
export const setDisappearing = asyncHandler(async (req, res) => {
  const otherUserId = req.params.userId;
  const me = req.user._id;
  const { enabled, seconds } = req.body;

  let conv = await OneToOneConversation.findOne({ participants: { $all: [me, otherUserId], $size: 2 } });
  if (!conv) conv = await OneToOneConversation.create({ participants: [me, otherUserId] });

  conv.disappearingEnabled = !!enabled;
  conv.disappearAfterSeconds = enabled ? Math.max(1, parseInt(seconds) || 30) : 0;
  await conv.save();

  res.json({ success: true, convId: conv._id, disappearingEnabled: conv.disappearingEnabled, disappearAfterSeconds: conv.disappearAfterSeconds });
});
