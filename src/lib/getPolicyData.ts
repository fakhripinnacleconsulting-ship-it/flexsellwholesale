import { unstable_cache, revalidateTag } from "next/cache";
import { pagesContent } from "@/config/pagesContent";

type PolicyKey = "privacy" | "terms" | "shipping" | "return";

/**
 * Fetch raw policy data from MongoDB CmsContent.
 * Wrapped in unstable_cache with 'cms-policies' tag so
 * revalidateTag('cms-policies') busts the data cache instantly on Vercel.
 */
const getCachedPolicies = unstable_cache(
  async () => {
    try {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CmsContent = (await import("@/models/CmsContent")).default;
      const cmsPoliciesDoc = await CmsContent.findOne({ key: "policies" }).lean();
      return cmsPoliciesDoc?.value || null;
    } catch (err) {
      console.error("CMS policies fetch error:", err);
      return null;
    }
  },
  ["cms-policies-data"],
  // Long window on purpose: revalidateTag('cms-policies') busts this instantly when an
  // admin edits policy text, so the timer is only a safety net. At 60s it was writing to
  // the data cache every minute, per region, for content that changes monthly.
  { tags: ["cms-policies"], revalidate: 86400 }
);

export async function getPolicyData(key: PolicyKey) {
  const defaultPolicy = pagesContent.policies[key];
  const cmsPolicies = await getCachedPolicies();
  const cmsPolicy = cmsPolicies?.[key];

  return {
    title: cmsPolicy?.title || defaultPolicy.title,
    lastUpdated: cmsPolicy?.lastUpdated || defaultPolicy.lastUpdated,
    content: cmsPolicy?.content || "",
    sections: defaultPolicy.sections,
  };
}
