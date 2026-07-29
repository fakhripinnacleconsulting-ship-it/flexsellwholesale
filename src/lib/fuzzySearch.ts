/**
 * Typo-Tolerant & Fuzzy Search Engine Helpers for FlexSell Wholesale
 * Maps common search misspellings and performs token distance matching.
 */

// Common typo alias map targeting frequent user search errors
export const TYPO_ALIAS_MAP: Record<string, string> = {
  // Brand & Competitor Typos
  flexsel: "flexsell",
  fleksell: "flexsell",
  flxsell: "flexsell",
  flexcell: "flexsell",
  flexcel: "flexsell",
  flexsale: "flexsell",
  diodap: "deodap",
  deodapp: "deodap",
  deodape: "deodap",

  // B2B & Sourcing Typos
  wholesail: "wholesale",
  holesale: "wholesale",
  wohlesale: "wholesale",
  wholestore: "wholesale",
  bulksale: "wholesale",
  bluk: "bulk",
  reseler: "reseller",
  resseller: "reseller",
  supplierr: "supplier",
  suplier: "supplier",

  // Category & Product Term Typos
  kichen: "kitchen",
  kithen: "kitchen",
  utlities: "utilities",
  utillities: "utilities",
  utilitys: "utilities",
  gadget: "gadgets",
  gadjad: "gadgets",
  gadgetz: "gadgets",
  organiser: "organizer",
  organizer: "organizer",
  botle: "bottle",
  botel: "bottle",
  chopper: "chopper",
  choper: "chopper",

  // Dropshipping Typos
  dropshiping: "dropshipping",
  dropshipin: "dropshipping",
  dropshippin: "dropshipping",
  dropship: "dropshipping",
  ecomerce: "ecommerce",
  "e-comerce": "ecommerce",
};

/**
 * Calculates Levenshtein Distance between two string tokens
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalizes query string by replacing known typo tokens with canonical equivalents.
 */
export function normalizeQueryWithTypos(query: string): { canonicalQuery: string; tokens: string[] } {
  const rawTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const normalizedTokens = rawTokens.map((token) => TYPO_ALIAS_MAP[token] || token);
  return {
    canonicalQuery: normalizedTokens.join(" "),
    tokens: normalizedTokens,
  };
}

/**
 * Evaluates whether a target text matches a query token with fuzzy tolerance.
 * Allows max 1 distance for tokens >= 4 chars, and max 2 distance for tokens >= 7 chars.
 */
export function fuzzyMatchesToken(targetWord: string, queryToken: string): boolean {
  const word = targetWord.toLowerCase();
  const token = queryToken.toLowerCase();

  if (word.includes(token) || token.includes(word)) return true;

  if (token.length >= 7 && levenshteinDistance(word, token) <= 2) return true;
  if (token.length >= 4 && levenshteinDistance(word, token) <= 1) return true;

  return false;
}
