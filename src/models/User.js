import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  avatar: { type: String, default: null },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
}, { timestamps: true });

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Hash password before save
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

export default mongoose.model("User", userSchema);
