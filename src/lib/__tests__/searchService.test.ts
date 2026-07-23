import { describe, it, expect } from "vitest";
import { calculateProductRelevanceScore } from "@/services/searchService";
import { Product, Category } from "@/types";

const mockCategory: Category = {
  _id: "cat-apparel",
  name: "Apparel & Clothing",
  slug: "apparel-clothing",
  image: "/cat.jpg",
  order: 1,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const categoryMap = new Map<string, Category>([[mockCategory._id, mockCategory]]);

const mockProduct: Product = {
  _id: "prod-101",
  title: "Premium Heavyweight Oversized T-Shirt",
  slug: "premium-heavyweight-oversized-t-shirt",
  description: "High quality 240 GSM cotton wholesale t-shirt.",
  categoryId: "cat-apparel",
  tags: ["tshirt", "oversized", "streetwear"],
  cardTags: ["Trending", "New"],
  isActive: true,
  totalStock: 150,
  rating: 4.8,
  reviewCount: 25,
  defaultPriceTier: "B2B",
  hsnCode: "61091000",
  colorVariants: [
    {
      color: "Black",
      dimensions: "30x20x2",
      images: ["/black.jpg"],
      subVariants: [
        {
          id: "sv-101",
          size: "XL",
          weight: "250g",
          mrp: 1200,
          b2cPrice: 799,
          b2bPrice: 450,
          dropshippingPrice: 500,
          discount: 33,
          stock: 50,
          sku: "TSH-BLK-XL",
          barcode: "8901234567890",
          isActive: true,
        },
        {
          id: "sv-102",
          size: "L",
          weight: "240g",
          mrp: 1200,
          b2cPrice: 799,
          b2bPrice: 450,
          dropshippingPrice: 500,
          discount: 33,
          stock: 100,
          sku: "TSH-BLK-L",
          barcode: "8901234567891",
          isActive: true,
        },
      ],
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("Search Service - Relevancy & Ranking Scoring", () => {
  it("should assign highest score to exact SKU query match", () => {
    const { score, matchedSku } = calculateProductRelevanceScore(mockProduct, "TSH-BLK-XL", categoryMap);
    expect(score).toBeGreaterThanOrEqual(95);
    expect(matchedSku).toBe("TSH-BLK-XL");
  });

  it("should handle case-insensitive SKU matching", () => {
    const { score, matchedSku } = calculateProductRelevanceScore(mockProduct, "tsh-blk-xl", categoryMap);
    expect(score).toBeGreaterThanOrEqual(95);
    expect(matchedSku).toBe("TSH-BLK-XL");
  });

  it("should assign high score to exact Product ID query match", () => {
    const { score } = calculateProductRelevanceScore(mockProduct, "prod-101", categoryMap);
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it("should match partial SKU search", () => {
    const { score, matchedSku } = calculateProductRelevanceScore(mockProduct, "TSH-BLK", categoryMap);
    expect(score).toBeGreaterThanOrEqual(75);
    expect(matchedSku).toBe("TSH-BLK-XL");
  });

  it("should match barcode query search", () => {
    const { score } = calculateProductRelevanceScore(mockProduct, "8901234567890", categoryMap);
    expect(score).toBeGreaterThanOrEqual(95);
  });

  it("should match HSN code query search", () => {
    const { score } = calculateProductRelevanceScore(mockProduct, "61091000", categoryMap);
    expect(score).toBeGreaterThanOrEqual(25);
  });

  it("should score title and category matches appropriately", () => {
    const titleRes = calculateProductRelevanceScore(mockProduct, "Oversized T-Shirt", categoryMap);
    expect(titleRes.score).toBeGreaterThan(0);

    const catRes = calculateProductRelevanceScore(mockProduct, "Apparel", categoryMap);
    expect(catRes.score).toBeGreaterThanOrEqual(25);
  });

  it("should score tags and cardTags appropriately", () => {
    const tagRes = calculateProductRelevanceScore(mockProduct, "streetwear", categoryMap);
    expect(tagRes.score).toBeGreaterThanOrEqual(20);

    const cardTagRes = calculateProductRelevanceScore(mockProduct, "Trending", categoryMap);
    expect(cardTagRes.score).toBeGreaterThanOrEqual(15);
  });

  it("should prioritize exact SKU match over title match", () => {
    const skuResult = calculateProductRelevanceScore(mockProduct, "TSH-BLK-XL", categoryMap);
    const titleResult = calculateProductRelevanceScore(mockProduct, "Heavyweight", categoryMap);
    expect(skuResult.score).toBeGreaterThan(titleResult.score);
  });

  it("should return score = 0 for irrelevant or empty query", () => {
    const { score: zeroScore } = calculateProductRelevanceScore(mockProduct, "UnrelatedProductXYZ", categoryMap);
    expect(zeroScore).toBe(0);

    const { score: emptyScore } = calculateProductRelevanceScore(mockProduct, "   ", categoryMap);
    expect(emptyScore).toBe(0);
  });
});
