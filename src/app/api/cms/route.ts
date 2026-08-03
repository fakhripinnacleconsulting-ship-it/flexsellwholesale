import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";
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
    const { defaultPolicies, defaultBlogs, defaultBusinessSettings, defaultHomepageHeadings, defaultHomepageSettings, defaultHomepageSeo } = require("@/lib/cmsHelper");

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

    if (!config.businessSettings) {
      config.businessSettings = defaultBusinessSettings;
    } else {
      config.businessSettings = {
        ...defaultBusinessSettings,
        ...config.businessSettings,
      };
    }

    if (!config.homepage_section_headings) {
      config.homepage_section_headings = defaultHomepageHeadings;
    } else {
      config.homepage_section_headings = {
        ...defaultHomepageHeadings,
        ...config.homepage_section_headings,
      };
    }

    if (!config.homepage_settings) {
      config.homepage_settings = defaultHomepageSettings;
    } else {
      config.homepage_settings = {
        ...defaultHomepageSettings,
        ...config.homepage_settings,
      };
    }

    if (!config.homepage_seo) {
      config.homepage_seo = defaultHomepageSeo;
    } else {
      config.homepage_seo = {
        ...defaultHomepageSeo,
        ...config.homepage_seo,
      };
    }

    // Keep brandDetails, bankDetails, and brandSettings unified
    const fullAddress = `${config.businessSettings.companyAddress || ""}, ${config.businessSettings.city || ""}, ${config.businessSettings.state || ""} - ${config.businessSettings.pinCode || ""}`;

    config.brandDetails = {
      storeName: config.businessSettings.storeName,
      legalName: config.businessSettings.legalName,
      supportEmail: config.businessSettings.supportEmail,
      supportPhone: config.businessSettings.supportPhone,
      companyAddress: fullAddress,
      gstin: config.businessSettings.gstin,
      ...(config.brandDetails || {}),
    };

    config.bankDetails = {
      beneficiaryName: config.businessSettings.accountName,
      bankName: config.businessSettings.bankName,
      accountNo: config.businessSettings.accountNumber,
      ifscCode: config.businessSettings.ifscCode,
      branch: config.businessSettings.branchName,
      ...(config.bankDetails || {}),
    };

    config.brandSettings = {
      storeName: config.businessSettings.storeName,
      gstin: config.businessSettings.gstin,
      companyAddress: fullAddress,
      supportEmail: config.businessSettings.supportEmail,
      supportPhone: config.businessSettings.supportPhone,
      ...(config.brandSettings || {}),
    };

    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch CMS content" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const auth = await requireAdminOrManagerAuth("content_cms:create");
    if (auth.error) return auth.error;
    const payload = auth.payload!;

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

    // Cross-sync alias keys when updating businessSettings, brandDetails, or bankDetails
    if (key === "businessSettings" && value) {
      const fullAddress = `${value.companyAddress || ""}, ${value.city || ""}, ${value.state || ""} - ${value.pinCode || ""}`;
      const brandDetailsVal = {
        storeName: value.storeName,
        legalName: value.legalName,
        supportEmail: value.supportEmail,
        supportPhone: value.supportPhone,
        companyAddress: fullAddress,
        gstin: value.gstin,
      };
      const bankDetailsVal = {
        beneficiaryName: value.accountName,
        bankName: value.bankName,
        accountNo: value.accountNumber,
        ifscCode: value.ifscCode,
        branch: value.branchName,
      };
      const brandSettingsVal = {
        storeName: value.storeName,
        gstin: value.gstin,
        companyAddress: fullAddress,
        supportEmail: value.supportEmail,
        supportPhone: value.supportPhone,
      };

      await Promise.all([
        CmsContent.findOneAndUpdate({ key: "brandDetails" }, { $set: { value: brandDetailsVal } }, { upsert: true }),
        CmsContent.findOneAndUpdate({ key: "bankDetails" }, { $set: { value: bankDetailsVal } }, { upsert: true }),
        CmsContent.findOneAndUpdate({ key: "brandSettings" }, { $set: { value: brandSettingsVal } }, { upsert: true }),
      ]);
    }

    revalidateCms();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update CMS content" }, { status: 500 });
  }
}
