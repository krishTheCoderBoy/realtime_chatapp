import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import dotenv from "dotenv";
dotenv.config();

export const protect = asyncHandler(async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, token missing");
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      res.status(401);
      throw new Error("User not found");
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token failed");
  }
});
