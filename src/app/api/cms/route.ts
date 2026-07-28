import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { revalidateCms } from "@/lib/revalidate";

import { initialDropshippingCMSData } from "@/lib/seedDropshippingCMS";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await dbConnect();
    const contents = await CmsContent.find().lean();
    
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

    // Auto-seed or deep merge policies with default initial content
    const defaultPolicies = {
      privacy: {
        title: "Corporate Privacy Policy",
        lastUpdated: "2026-07-27",
        content: `<h3>1. Scope of Data Gathering</h3><p>We gather business credentials, shipping addresses, GST certificates, and contact details to verify authenticity and streamline wholesale invoicing.</p><h3>2. Data Protection Standards</h3><p>All sensitive payment credentials are encrypted using industry-standard AES-256 protocols. Your trade secrets and supplier details remain confidential.</p>`,
      },
      terms: {
        title: "B2B Terms of Service",
        lastUpdated: "2026-07-27",
        content: `<h3>1. Retail Reselling Authorizations</h3><p>Buyers warrant that they are registered businesses purchasing goods for commercial resale or manufacturing purposes, not personal consumption.</p><h3>2. Account Suspension Thresholds</h3><p>We reserve the right to cancel accounts and restrict wholesale pricing for buyers providing fraudulent business IDs or repeatedly returning bulk orders.</p>`,
      },
      shipping: {
        title: "Freight & Shipping Policies",
        lastUpdated: "2026-07-27",
        content: `<h3>1. Dispatch Timelines</h3><p>Bulk wholesale orders are packed and dispatched from our Bhopal warehouse within 24-48 working hours. Heavy freight shipping times range from 3-7 days.</p><h3>2. Remote Region Logistics Surcharges</h3><p>Special transport charges may apply for heavy freight going to Northeast states, J&K, and deep rural regions. Surcharges will be quoted by phone if needed.</p>`,
      },
      return: {
        title: "Bulk Return & Refund Policies",
        lastUpdated: "2026-07-27",
        content: `<h3>1. Zero Unsold Returns</h3><p>Because we run at minimal margins, we do not accept returns for unsold goods or change-of-mind situations. All wholesale sales are final.</p><h3>2. Transit Defect Claims</h3><p>A continuous, uncut video showing the opening of the parcel package is mandatory to process shipping transit damage claims. Approved claims receive wallet top-up credits.</p>`,
      },
    };

    if (!config.policies || Object.keys(config.policies).length === 0) {
      config.policies = defaultPolicies;
    } else {
      config.policies = {
        privacy: { ...defaultPolicies.privacy, ...(config.policies.privacy || {}) },
        terms: { ...defaultPolicies.terms, ...(config.policies.terms || {}) },
        shipping: { ...defaultPolicies.shipping, ...(config.policies.shipping || {}) },
        return: { ...defaultPolicies.return, ...(config.policies.return || {}) },
      };
    }

    const defaultBlogs = [
      {
        title: "10 Wholesale Trends Shaping Indian B2B E-commerce in 2026",
        slug: "wholesale-b2b-trends-2026",
        category: "Industry News",
        author: "FlexSell Research Team",
        excerpt: "Discover how direct-from-manufacturer sourcing, automated MOQ tier pricing, and instant GST invoicing are transforming wholesale distribution in India.",
        content: `<h2>1. Direct Manufacturer Sourcing</h2><p>Indian B2B buyers are moving away from multi-tier regional distributors toward direct factory sourcing to capture maximum gross margins.</p><h2>2. Automated Tier Pricing & Tiered MOQs</h2><p>Dynamic tier pricing allows resellers to order smaller trial quantities while unlocking deep wholesale discounts as volume scales.</p>`,
        coverImage: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
        readTime: "4 min read",
        publishedAt: new Date().toISOString(),
        isActive: true
      },
      {
        title: "How to Build a High-Margin Dropshipping Business with Zero Inventory",
        slug: "high-margin-dropshipping-guide",
        category: "Dropshipping",
        author: "FlexSell Trade Team",
        excerpt: "Learn how to launch your branded online store using white-label shipping, verified supplier stocks, and fast 48-hour delivery across India.",
        content: `<h2>Zero Capital Risk</h2><p>Dropshipping empowers digital entrepreneurs to sell premium household and electronics products without tying up capital in inventory warehousing.</p><h2>White-Label Packaging</h2><p>Deliver orders under your own brand identity with custom invoice headers and unbranded shipping boxes.</p>`,
        coverImage: "https://images.unsplash.com/photo-1556742049-0a67daf64f42?auto=format&fit=crop&w=1200&q=80",
        readTime: "5 min read",
        publishedAt: new Date().toISOString(),
        isActive: true
      }
    ];

    if (!config.blogs || !Array.isArray(config.blogs) || config.blogs.length === 0) {
      config.blogs = defaultBlogs;
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
      { $set: { value } },
      { upsert: true, new: true }
    ).lean();

    revalidateCms();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update CMS content" }, { status: 500 });
  }
}
