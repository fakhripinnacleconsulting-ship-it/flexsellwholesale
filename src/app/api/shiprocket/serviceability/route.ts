import { NextResponse, NextRequest } from "next/server";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { shiprocketClient } from "@/lib/shiprocketClient";

export async function POST(request: NextRequest) {
  try {
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { pickupPinCode, deliveryPinCode, weight, isCod } = body;

    if (!deliveryPinCode) {
      return NextResponse.json({ message: "Delivery pin code is required" }, { status: 400 });
    }

    const weightKg = Number(weight) > 0 ? Number(weight) : 0.5;

    const data = await shiprocketClient.checkServiceability({
      pickupPinCode,
      deliveryPinCode,
      weight: weightKg,
      isCod: Boolean(isCod),
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch courier serviceability" }, { status: 500 });
  }
}
