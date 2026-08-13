import mongoose from "mongoose";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env");
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 3000, // Fail fast in 3s if MongoDB Atlas is unreachable
      connectTimeoutMS: 3000,
      socketTimeoutMS: 5000,
      maxPoolSize: 10,
      family: 4, // Force IPv4 to prevent IPv6 DNS resolution timeouts
      // Mongoose defaults autoIndex to true, which issues a createIndex for every index
      // on all 18 models on every cold start. On serverless that is recurring CPU and
      // connection overhead for indexes that already exist.
      //
      // NOTE: indexes must therefore be created out-of-band in production. Kept on in
      // development so local schema changes still build their indexes automatically.
      autoIndex: process.env.NODE_ENV !== "production",
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
