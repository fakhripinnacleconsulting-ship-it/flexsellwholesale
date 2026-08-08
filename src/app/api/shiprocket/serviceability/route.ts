import { NextResponse, NextRequest } from "next/server";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";
import { shiprocketClient } from "@/lib/shiprocketClient";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminOrManagerAuth();
    if (auth.error) return auth.error;

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
