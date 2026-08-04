import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import ShippingConfig from "@/models/ShippingConfig";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";

export async function GET() {
  try {
    await dbConnect();
    let config = await ShippingConfig.findOne({ _id: "shipping-config" } as any).lean() as any;
    if (!config) {
      config = await ShippingConfig.create({
        _id: "shipping-config",
        weightSlabs: [],
        b2bFixedCharge: 150,
        dropshippingFixedCharge: 0,
      } as any);
      config = config.toObject();
    } else if (config.dropshippingFixedCharge === 80) {
      // Auto-migrate legacy production DB document from old schema default (80) to 0
      await ShippingConfig.updateOne({ _id: "shipping-config" } as any, { $set: { dropshippingFixedCharge: 0 } });
      config.dropshippingFixedCharge = 0;
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
    const auth = await requireAdminOrManagerAuth("ops_shipping:update");
    if (auth.error) return auth.error;

    const body = await request.json();
    const { weightSlabs, b2bFixedCharge, dropshippingFixedCharge, shiprocket } = body;

    let config = await ShippingConfig.findOne({ _id: "shipping-config" } as any);
    if (!config) {
      config = new ShippingConfig({ _id: "shipping-config" } as any);
    }

    if (weightSlabs !== undefined) config.weightSlabs = weightSlabs;
    if (b2bFixedCharge !== undefined) config.b2bFixedCharge = b2bFixedCharge;
    if (dropshippingFixedCharge !== undefined) config.dropshippingFixedCharge = dropshippingFixedCharge;
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

    const { revalidateStorefront } = await import("@/lib/revalidate");
    revalidateStorefront();

    return NextResponse.json(resp);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update shipping configuration" }, { status: 500 });
  }
}
