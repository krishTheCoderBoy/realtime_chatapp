import express from "express";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  createGroup,
  getGroupsForUser,
  getGroupMessages,
  sendGroupMessage,
  addGroupMember,
  recallGroupMessage
} from "../controllers/groupController.js";

const router = express.Router();

router.use(protect);

router.post("/group/create", upload.single("groupAvatar"), createGroup);
router.get("/groups", getGroupsForUser);
router.get("/group/:groupId", getGroupMessages);
router.post("/group/:groupId/send", upload.single("file"), sendGroupMessage);
router.post("/group/:groupId/add-member", addGroupMember);
router.post("/group/:groupId/recall/:messageId", recallGroupMessage);

export default router;
