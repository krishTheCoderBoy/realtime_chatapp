import express from "express";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  getConversations,
  getOrCreateConversationMessages,
  sendMessageToUser,
  recallMessage,
  setDisappearing
} from "../controllers/oneToOneController.js";

const router = express.Router();

router.use(protect);

router.get("/conversations", getConversations);
router.get("/conversation/:userId", getOrCreateConversationMessages);
router.post("/conversation/:userId", upload.single("file"), sendMessageToUser);
router.post("/conversation/:userId/recall/:messageId", recallMessage);
router.post("/conversation/:userId/disappearing", setDisappearing);

export default router;
