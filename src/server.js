import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

// ✅ First: resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load .env (your .env is one level above /src)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// DB
import { connectDB } from "./config/db.js";

// Routes
import authRoutes from "./routes/auth.js";
import oneToOneRoutes from "./routes/oneToOne.js";
import groupRoutes from "./routes/group.js";

// Middleware
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import socketHandlers from "./sockets/index.js";
import { startCleanupService } from "./services/cleanupService.js";

const app = express();
const server = http.createServer(app);

const io = new IOServer(server, {
  cors: {
    origin: "*", // change to your frontend origin if needed
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
});
app.use(limiter);

// Static file serving
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

// ✅ Connect to MongoDB
connectDB();

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", oneToOneRoutes);
app.use("/api", groupRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.io handlers
socketHandlers(io);

// Cleanup service
startCleanupService();

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
