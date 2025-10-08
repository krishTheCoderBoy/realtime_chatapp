import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, default: "" }, // text or file url
  type: { type: String, enum: ["text", "photo", "video"], default: "text" },
  createdAt: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // read receipts
  recalled: { type: Boolean, default: false }, // message recalled by sender
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // optional per-user deletion
  expiresAt: { type: Date, default: null }, // for disappearing messages
}, { timestamps: true });

// TTL index is not used here because we may need controlled deletion; cleanupService handles deletion.
// But you could uncomment to auto-delete if you prefer:
// messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Message", messageSchema);
