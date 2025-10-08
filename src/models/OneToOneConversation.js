import mongoose from "mongoose";

const oneToOneSchema = new mongoose.Schema({
  participants: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    validate: [arr => arr.length === 2, "OneToOne must have exactly 2 participants"],
    required: true,
    index: true
  },
  messages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
  disappearingEnabled: { type: Boolean, default: false },
  disappearAfterSeconds: { type: Number, default: 0 } // 0 = off, otherwise seconds
}, { timestamps: true });

// Compound index to quickly find conversation by participants (order-independent)
oneToOneSchema.index({ participants: 1 });

export default mongoose.model("OneToOneConversation", oneToOneSchema);
