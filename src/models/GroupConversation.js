import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
  groupAvatar: { type: String, default: null },
  disappearingEnabled: { type: Boolean, default: false },
  disappearAfterSeconds: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("GroupConversation", groupSchema);
