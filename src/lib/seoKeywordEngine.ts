/**
 * FlexSell Wholesale — Enterprise Combinatorial Keyword Permutation Engine
 * Generates thousands of search query variations for Search Engines, Voice Search & AI LLMs.
 */

export const BRAND_KEYWORDS = [
  "FlexSell", "Flex Sell", "FlexSellWholesale", "Flex Sell Wholesale",
  "FlexSellWholesale.com", "FlexSell India", "FlexSell Marketplace", "FlexSell Online",
  "FlexSell Store", "FlexSell Platform", "FlexSell Supplier", "FlexSell Distributor",
  "FlexSell Manufacturer", "FlexSell Ecommerce", "FlexSell Wholesale Marketplace",
  "FlexSell B2B", "FlexSell B2C", "FlexSell App", "FlexSell Login", "FlexSell Website"
];

export const TYPO_KEYWORDS = [
  "Flexsale", "Flex Sale", "Flexsel", "FlexSelll", "FlexSells",
  "FlexSell Wholesell", "FlexSell WholeSeller", "FlexSaleWholesale",
  "FlexSaleWholesell", "FlexSaleWholesaler", "Flex Wholesell", "Fleksell",
  "Flexseel", "Flaxsell", "Flexsil", "Flesell", "Flesale", "Flexseller"
];

export const SERVICE_KEYWORDS = [
  "Wholesale", "Wholesale Marketplace", "Wholesale Products", "Wholesale Buying",
  "Bulk Products", "Bulk Buying", "Bulk Orders", "Manufacturer Direct",
  "Factory Direct", "Supplier Marketplace", "B2B Ecommerce", "B2B Marketplace",
  "B2B Suppliers", "B2B Manufacturers", "B2B Wholesale", "Dropshipping",
  "Dropshipping India", "Amazon Dropshipping", "Flipkart Dropshipping",
  "Meesho Dropshipping", "Shopify Dropshipping", "Private Label", "White Label",
  "OEM", "ODM", "Reseller", "Importer", "Wholesaler"
];

export const CATEGORY_KEYWORDS = [
  "Kitchen", "Household Utilities", "Home Decor", "Electronics", "Mobile Accessories",
  "Laptop Accessories", "Hardware", "Tools", "Electrical", "Fashion Accessories",
  "Beauty", "Cosmetics", "Packaging", "Plastic Products", "Toys", "Gift Items"
];

export const INTENT_MODIFIERS = [
  "Best", "Top", "Trusted", "Verified", "Official", "Fast", "Affordable",
  "Cheap", "Premium", "Direct Supplier", "Low Price", "High Quality", "Near Me"
];

export const LOCATION_KEYWORDS = [
  "India", "Bhopal", "Indore", "Delhi", "Mumbai", "Pune", "Ahmedabad",
  "Surat", "Jaipur", "Lucknow", "Noida", "Gurgaon", "Hyderabad",
  "Bangalore", "Chennai", "Kolkata", "Nagpur", "Gwalior", "Jabalpur", "Ujjain"
];

export const QUESTION_PATTERNS = [
  "Where to Buy", "Where to Sell", "How to Buy", "How to Sell",
  "Best Website for", "Best Marketplace for", "Best Wholesale Website in"
];

/**
 * Generate Combinatorial Keyword Permutations
 */
export function generateKeywordCombinations(limit: number = 500): string[] {
  const set = new Set<string>();

  // 1. Brand + Service + Location
  for (const b of BRAND_KEYWORDS) {
    for (const s of SERVICE_KEYWORDS.slice(0, 5)) {
      for (const l of LOCATION_KEYWORDS.slice(0, 5)) {
        set.add(`${b} ${s} ${l}`);
        if (set.size >= limit) return Array.from(set);
      }
    }
  }

  // 2. Intent + Category + Service + Location
  for (const i of INTENT_MODIFIERS.slice(0, 5)) {
    for (const c of CATEGORY_KEYWORDS.slice(0, 5)) {
      for (const s of SERVICE_KEYWORDS.slice(0, 5)) {
        for (const l of LOCATION_KEYWORDS.slice(0, 5)) {
          set.add(`${i} ${c} ${s} ${l}`);
          if (set.size >= limit) return Array.from(set);
        }
      }
    }
  }

  // 3. Question + Service + Location
  for (const q of QUESTION_PATTERNS.slice(0, 4)) {
    for (const s of SERVICE_KEYWORDS.slice(0, 5)) {
      for (const l of LOCATION_KEYWORDS.slice(0, 5)) {
        set.add(`${q} ${s} in ${l}`);
        if (set.size >= limit) return Array.from(set);
      }
    }
  }

  return Array.from(set);
}
