import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ShippingConfig from "@/models/ShippingConfig";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    await dbConnect();
    let config = await ShippingConfig.findOne({ _id: "shipping-config" }).lean() as any;
    if (!config) {
      config = await ShippingConfig.create({
        _id: "shipping-config",
        weightSlabs: [],
        b2bFixedCharge: 150,
      });
      config = config.toObject();
    }
    if (config.shiprocket) {
      config.shiprocket.password = config.shiprocket.password ? "••••••••" : "";
    }
    return NextResponse.json(config);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch shipping configuration" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const { weightSlabs, b2bFixedCharge, shiprocket } = body;

    let config = await ShippingConfig.findOne({ _id: "shipping-config" });
    if (!config) {
      config = new ShippingConfig({ _id: "shipping-config" });
    }

    if (weightSlabs !== undefined) config.weightSlabs = weightSlabs;
    if (b2bFixedCharge !== undefined) config.b2bFixedCharge = b2bFixedCharge;
    if (shiprocket !== undefined) {
      config.shiprocket = {
        ...config.shiprocket,
        ...shiprocket,
      };
    }

    await config.save();
    const resp = config.toObject();
    if (resp.shiprocket) {
      resp.shiprocket.password = resp.shiprocket.password ? "••••••••" : "";
    }
    return NextResponse.json(resp);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update shipping configuration" }, { status: 500 });
  }
}
