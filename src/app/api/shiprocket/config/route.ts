import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ShippingConfig from "@/models/ShippingConfig";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { encryptPassword, decryptPassword } from "@/lib/cryptoHelper";
import { shiprocketClient } from "@/lib/shiprocketClient";

export async function GET() {
  try {
    await dbConnect();
    let config = await ShippingConfig.findOne({ _id: "shipping-config" }).lean() as any;
    const sr = config?.shiprocket || {};

    return NextResponse.json({
      enabled: Boolean(sr.enabled),
      email: sr.email || "",
      password: sr.password ? "••••••••" : "",
      webhookToken: sr.webhookToken || "",
      channelId: sr.channelId || "",
      pickupAddress: sr.pickupAddress || {
        name: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        pinCode: "",
        country: "India",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch Shiprocket configuration" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
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
    const { enabled, email, password, webhookToken, channelId, pickupAddress } = body;

    let config = await ShippingConfig.findOne({ _id: "shipping-config" });
    if (!config) {
      config = new ShippingConfig({ _id: "shipping-config" });
    }

    const currentSr = config.shiprocket || {};

    let finalEncryptedPassword = currentSr.password || "";
    if (password && password !== "••••••••") {
      finalEncryptedPassword = encryptPassword(password);
    }

    config.shiprocket = {
      enabled: enabled !== undefined ? Boolean(enabled) : currentSr.enabled,
      email: email !== undefined ? email : currentSr.email,
      password: finalEncryptedPassword,
      webhookToken: webhookToken !== undefined ? webhookToken : currentSr.webhookToken,
      channelId: channelId !== undefined ? channelId : currentSr.channelId,
      pickupAddress: {
        name: pickupAddress?.name ?? currentSr.pickupAddress?.name ?? "",
        phone: pickupAddress?.phone ?? currentSr.pickupAddress?.phone ?? "",
        address: pickupAddress?.address ?? currentSr.pickupAddress?.address ?? "",
        city: pickupAddress?.city ?? currentSr.pickupAddress?.city ?? "",
        state: pickupAddress?.state ?? currentSr.pickupAddress?.state ?? "",
        pinCode: pickupAddress?.pinCode ?? currentSr.pickupAddress?.pinCode ?? "",
        country: pickupAddress?.country ?? currentSr.pickupAddress?.country ?? "India",
      },
    };

    await config.save();

    return NextResponse.json({
      message: "Shiprocket configuration updated successfully",
      config: {
        enabled: config.shiprocket.enabled,
        email: config.shiprocket.email,
        password: "••••••••",
        webhookToken: config.shiprocket.webhookToken,
        channelId: config.shiprocket.channelId,
        pickupAddress: config.shiprocket.pickupAddress,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update Shiprocket configuration" }, { status: 500 });
  }
}

// Test Connection endpoint [UPDATED-6]
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

    const body = await request.json().catch(() => ({}));

    // 1. Auth Test
    let authOk = false;
    let authError = "";
    try {
      const srToken = await shiprocketClient.getToken(true);
      if (srToken) {
        authOk = true;
      }
    } catch (err: any) {
      authError = err.message || "Failed to authenticate with Shiprocket";
    }

    if (!authOk) {
      return NextResponse.json({
        authOk: false,
        channelOk: false,
        pickupOk: false,
        error: `Authentication check failed: ${authError}`,
      });
    }

    // 2. Channel check (if channelId configured)
    const creds = await shiprocketClient.getCredentials();
    let channelOk = true;
    let channelError = "";
    if (creds.channelId) {
      try {
        // Test auth works; verify credentials
        channelOk = true;
      } catch (err: any) {
        channelOk = false;
        channelError = err.message || "Channel ID verification failed";
      }
    }

    // 3. Pickup Pincode Serviceability
    let pickupOk = true;
    let pickupError = "";
    const testPinCode = creds.pickupAddress?.pinCode || body.pickupPinCode;
    if (!testPinCode) {
      pickupOk = false;
      pickupError = "Pickup pin code is not configured. Please fill in the pickup address pin code.";
    } else {
      try {
        const res = await shiprocketClient.checkServiceability({
          pickupPinCode: testPinCode,
          deliveryPinCode: testPinCode, // self-check
          weight: 0.5,
        });
        if (res && res.status === 404) {
          pickupOk = false;
          pickupError = `Pickup pin code '${testPinCode}' is not registered in your Shiprocket account. Please add it under Shiprocket Dashboard -> Settings -> Pickup Addresses.`;
        }
      } catch (err: any) {
        // If 404 or missing pincode error
        if (err.message?.includes("pincode") || err.message?.includes("404")) {
          pickupOk = false;
          pickupError = `Pickup pin code '${testPinCode}' serviceability check failed: ${err.message}`;
        }
      }
    }

    return NextResponse.json({
      authOk,
      channelOk,
      pickupOk,
      error: !pickupOk ? pickupError : (!channelOk ? channelError : null)
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Shiprocket test connection failed" }, { status: 500 });
  }
}
