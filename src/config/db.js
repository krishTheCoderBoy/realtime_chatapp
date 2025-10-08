import mongoose from "mongoose";

export const connectDB = async () => {
  try {
   const conn = await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
    tlsAllowInvalidCertificates: true
   });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log("MongoDB connected");

  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
};
