import { pagesContent } from "@/config/pagesContent";

export async function getPolicyData(key: "privacy" | "terms" | "shipping" | "return") {
  let cmsPolicies: any = null;
  try {
    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();
    const CmsContent = (await import("@/models/CmsContent")).default;
    const cmsPoliciesDoc = await CmsContent.findOne({ key: "policies" }).lean();
    cmsPolicies = cmsPoliciesDoc?.value;
  } catch (err) {
    console.error(`Policy fetch notice for ${key}:`, err);
  }

  const defaultPolicy = pagesContent.policies[key];
  const cmsPolicy = cmsPolicies?.[key];

  return {
    title: cmsPolicy?.title || defaultPolicy.title,
    lastUpdated: cmsPolicy?.lastUpdated || defaultPolicy.lastUpdated,
    content: cmsPolicy?.content || "",
    sections: defaultPolicy.sections,
  };
}
