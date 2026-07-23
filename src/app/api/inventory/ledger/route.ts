import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import StockLog from "@/models/StockLog";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const logs = await StockLog.find({}).sort({ createdAt: -1 });
    return NextResponse.json(logs);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to fetch ledger logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    if (!body._id) {
      body._id = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
    }

    const newLog = await StockLog.create(body);
    return NextResponse.json(newLog, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to save stock log" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await StockLog.deleteMany({});
    return NextResponse.json({ message: "Ledger history cleared successfully" });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to clear ledger history" },
      { status: 500 }
    );
  }
}
