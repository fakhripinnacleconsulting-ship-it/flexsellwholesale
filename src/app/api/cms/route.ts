import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { revalidateCms } from "@/lib/revalidate";

import { initialDropshippingCMSData } from "@/lib/seedDropshippingCMS";

export async function GET() {
  try {
    await dbConnect();
    const contents = await CmsContent.find();
    
    // Map list of CMS documents into a key-value structure
    const config: Record<string, any> = {};
    contents.forEach(item => {
      config[item.key] = item.value;
    });

    // Auto-seed or deep merge dropshipping_cms with initial default values
    if (!config.dropshipping_cms) {
      await CmsContent.findOneAndUpdate(
        { key: "dropshipping_cms" },
        { value: initialDropshippingCMSData },
        { upsert: true, new: true }
      );
      config.dropshipping_cms = initialDropshippingCMSData;
    } else {
      config.dropshipping_cms = {
        ...initialDropshippingCMSData,
        ...config.dropshipping_cms,
        hero: { ...initialDropshippingCMSData.hero, ...(config.dropshipping_cms.hero || {}) },
        whyFlexsell: { ...initialDropshippingCMSData.whyFlexsell, ...(config.dropshipping_cms.whyFlexsell || {}) },
        howItWorks: { ...initialDropshippingCMSData.howItWorks, ...(config.dropshipping_cms.howItWorks || {}) },
        comparison: { ...initialDropshippingCMSData.comparison, ...(config.dropshipping_cms.comparison || {}) },
        pricing: { ...initialDropshippingCMSData.pricing, ...(config.dropshipping_cms.pricing || {}) },
        bankDetails: { ...initialDropshippingCMSData.bankDetails, ...(config.dropshipping_cms.bankDetails || {}) },
        gstDetails: { ...initialDropshippingCMSData.gstDetails, ...(config.dropshipping_cms.gstDetails || {}) },
        shippingRates: { ...initialDropshippingCMSData.shippingRates, ...(config.dropshipping_cms.shippingRates || {}) },
        terms: { ...initialDropshippingCMSData.terms, ...(config.dropshipping_cms.terms || {}) },
      };
    }

    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch CMS content" }, { status: 500 });
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
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ message: "CMS key is required" }, { status: 400 });
    }

    const updated = await CmsContent.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );

    revalidateCms();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update CMS content" }, { status: 500 });
  }
}
