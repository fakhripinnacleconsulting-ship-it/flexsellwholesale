import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Newsletter from "@/models/Newsletter";

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const email = (body?.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Please provide a valid email address." }, { status: 400 });
    }

    await Newsletter.findOneAndUpdate(
      { email },
      { email, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({ message: "Subscribed successfully" }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to subscribe" }, { status: 500 });
  }
}
