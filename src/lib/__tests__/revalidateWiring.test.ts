import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Verifies the purge actually reaches every surface a product appears on.
 *
 * Two defects sat here: `revalidateProducts` was called without the product id at every site,
 * so `revalidatePath("/products/<id>")` never ran; and category and collection pages were
 * never purged at all, so a change showed on the home page at once and on a category page a
 * day later.
 */

// dbConnect throws on a missing MONGODB_URI before any mock can intervene on the dynamic
// import; the value is never dialled because the model reads below are stubbed.
process.env.MONGODB_URI = "mongodb://test";

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
  revalidateTag: vi.fn(),
}));

const mockDbConnect = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/dbConnect", () => ({ default: mockDbConnect }));
vi.mock("@/models/Collection", () => ({
  default: { find: () => ({ select: () => ({ lean: () => Promise.resolve([{ slug: "monsoon-sale" }]) }) }) },
}));
vi.mock("@/models/Category", () => ({
  default: { find: () => ({ select: () => ({ lean: () => Promise.resolve([{ slug: "kitchen" }, { slug: "toys" }]) }) }) },
}));

import { revalidateProducts } from "../revalidate";

describe("revalidateProducts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("purges the listings, the product's own page, and every category and collection", async () => {
    await revalidateProducts("PROD-0164");

    const purged = mockRevalidatePath.mock.calls.map((c) => c[0]);
    expect(purged).toEqual(
      expect.arrayContaining([
        "/",
        "/products",
        "/products/PROD-0164",          // was dead code — the id was never passed
        "/categories/kitchen",
        "/categories/toys",             // every category, so a moved product leaves the old one
        "/collections/monsoon-sale",    // covers smart collections, whose membership is a rule
      ])
    );
  });

  it("still purges the listings when no product id is given (bulk import)", async () => {
    await revalidateProducts();

    const purged = mockRevalidatePath.mock.calls.map((c) => c[0]);
    expect(purged).toContain("/");
    expect(purged).toContain("/products");
    expect(purged).toContain("/categories/kitchen");
    expect(purged.some((p) => String(p).startsWith("/products/"))).toBe(false);
  });
});
