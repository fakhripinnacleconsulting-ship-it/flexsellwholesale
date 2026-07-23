import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import HsnRecord from "@/models/HsnRecord";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    
    const updatedRecord = await HsnRecord.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    
    if (!updatedRecord) {
      return NextResponse.json({ message: "HSN record not found" }, { status: 404 });
    }
    
    return NextResponse.json(updatedRecord);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update HSN record" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    
    const deletedRecord = await HsnRecord.findByIdAndDelete(id);
    
    if (!deletedRecord) {
      return NextResponse.json({ message: "HSN record not found" }, { status: 404 });
    }
    
    return NextResponse.json({ message: "HSN record deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete HSN record" }, { status: 500 });
  }
}
