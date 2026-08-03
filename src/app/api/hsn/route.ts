import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import HsnRecord from "@/models/HsnRecord";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";

export async function GET() {
  try {
    await dbConnect();
    const records = await HsnRecord.find({});
    return NextResponse.json(records);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch HSN records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const auth = await requireAdminOrManagerAuth("ops_hsn:create");
    if (auth.error) return auth.error;

    const body = await request.json();
    
    // Generate a random ID if not provided
    if (!body._id) {
      body._id = `hsn_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    const newRecord = await HsnRecord.create(body);
    return NextResponse.json(newRecord, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to create HSN record" }, { status: 500 });
  }
}
