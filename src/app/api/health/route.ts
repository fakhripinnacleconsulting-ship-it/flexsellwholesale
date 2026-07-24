import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

export async function GET() {
  try {
    const startTime = Date.now();
    await dbConnect();
    const dbState = mongoose.connection.readyState;
    
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    const stateMap: Record<number, string> = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    const isHealthy = dbState === 1;
    const responseTimeMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: stateMap[dbState] || "unknown",
          responseTimeMs,
        },
      },
      { status: isHealthy ? 200 : 503 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: (error as Error).message || "Database connection failed",
      },
      { status: 503 }
    );
  }
}
