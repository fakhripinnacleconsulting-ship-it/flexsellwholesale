import { describe, it, expect } from "vitest";
import { slugify, uniqueSlug, SLUG_MAX_LENGTH } from "../slugify";

/**
 * The regression these guard against reached production: a bulk-imported marketing title
 * became a 200-plus character path segment, and the product detail page broke while the
 * listing kept working.
 */

// The actual title from the production failure.
const LONG_TITLE =
  "Microfiber Cleaning Cloth 250 GSM, 30 x 30 cm | Double Sided Absorbent Lint Free " +
  "Car Bike Detailing Cloth for Cleaning Polishing Dusting Glass Kitchen Home Office Use Assorted";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Microfiber Cleaning Cloth")).toBe("microfiber-cleaning-cloth");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(slugify("250 GSM, 30 x 30 cm | Double-Sided")).toBe("250-gsm-30-x-30-cm-double-sided");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  ...Assorted!  ")).toBe("assorted");
  });

  it("caps the length", () => {
    const result = slugify(LONG_TITLE);
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });

  it("truncates at a word boundary, never mid-word", () => {
    // The old generator cut at exactly 80 characters, producing fragments like "lint-fr".
    const result = slugify(LONG_TITLE);
    const words = result.split("-");
    expect(words[words.length - 1]).not.toBe("");
    // Every segment should be a whole word from the title.
    const titleWords = LONG_TITLE.toLowerCase().replace(/[^a-z0-9]+/g, "-").split("-");
    for (const word of words) {
      expect(titleWords, `"${word}" should be a whole word from the title`).toContain(word);
    }
  });

  it("never ends in a hyphen, so an appended suffix cannot double up", () => {
    // `...assorted-` + `-8808` is what produced the double hyphens in production URLs.
    for (const title of [LONG_TITLE, "Cloth for Cleaning -", "A".repeat(200), "Ends With Space "]) {
      expect(slugify(title).endsWith("-"), title.slice(0, 30)).toBe(false);
    }
  });

  it("falls back to a hard cut when the first word exceeds the limit", () => {
    const oneLongWord = "a".repeat(200);
    expect(slugify(oneLongWord)).toBe("a".repeat(SLUG_MAX_LENGTH));
  });

  it("returns an empty string for input with no usable characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("tolerates null and undefined rather than throwing", () => {
    expect(slugify(null as unknown as string)).toBe("");
    expect(slugify(undefined as unknown as string)).toBe("");
  });

  it("honours a caller-supplied limit", () => {
    expect(slugify("one two three four five", 12).length).toBeLessThanOrEqual(12);
  });
});

describe("uniqueSlug", () => {
  it("returns the base when nothing collides", async () => {
    const result = await uniqueSlug("Cleaning Cloth", async () => false);
    expect(result).toBe("cleaning-cloth");
  });

  it("counts up on collision", async () => {
    const taken = new Set(["cleaning-cloth", "cleaning-cloth-2"]);
    const result = await uniqueSlug("Cleaning Cloth", async (c) => taken.has(c));
    expect(result).toBe("cleaning-cloth-3");
  });

  it("uses a readable counter, not a timestamp", async () => {
    // "-2" says "the second product with this name". "-8808" says nothing and changes on
    // every attempt, so the same import twice produced two different slugs.
    const taken = new Set(["cloth"]);
    const result = await uniqueSlug("Cloth", async (c) => taken.has(c));
    expect(result).toBe("cloth-2");
    expect(result).not.toMatch(/\d{4}$/);
  });

  it("is stable — the same title and state gives the same slug", async () => {
    const taken = new Set(["cloth"]);
    const exists = async (c: string) => taken.has(c);
    expect(await uniqueSlug("Cloth", exists)).toBe(await uniqueSlug("Cloth", exists));
  });

  it("keeps the suffixed result within a sane length", async () => {
    const result = await uniqueSlug(LONG_TITLE, async () => false);
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
  });

  it("substitutes a placeholder when the title slugifies to nothing", async () => {
    // Otherwise the stored slug would be "" — which the unique index treats as a real value,
    // so the second such product would fail to save.
    expect(await uniqueSlug("!!!", async () => false)).toBe("item");
  });

  it("gives up on the counter after a thousand collisions rather than looping forever", async () => {
    const result = await uniqueSlug("Cloth", async (c) => c !== "cloth-x", 70);
    expect(result).toBeTruthy();
    expect(result.startsWith("cloth")).toBe(true);
  });
});
