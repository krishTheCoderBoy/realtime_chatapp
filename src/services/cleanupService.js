/**
 * cleanupService: periodically delete messages whose expiresAt < now
 * Uses node-cron specification from env. Keeps logs.
 */
import cron from "node-cron";
import Message from "../models/Message.js";
import dotenv from "dotenv";
dotenv.config();

export const startCleanupService = () => {
  const schedule = process.env.CLEANUP_CRON_SCHEDULE || "*/1 * * * *"; // default every minute
  cron.schedule(schedule, async () => {
    try {
      const now = new Date();
      const expired = await Message.find({ expiresAt: { $lte: now } });
      if (expired.length > 0) {
        const ids = expired.map(m => m._id);
        await Message.deleteMany({ _id: { $in: ids } });
        console.log(`CleanupService: deleted ${ids.length} expired messages`);
        // Optionally notify sockets about deletions
      }
    } catch (err) {
      console.error("CleanupService error:", err);
    }
  }, { timezone: "UTC" });
};
