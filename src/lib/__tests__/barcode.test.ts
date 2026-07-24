import { describe, it, expect } from "vitest";
import { getBarcodeSvgString } from "../barcodeHelper";
import { resolveBarcode } from "@/services/barcodeResolver";
import { Product } from "@/types";

describe("Barcode Helper & Code 128 Generator", () => {
  it("should generate a valid non-empty SVG string for standard SKUs", () => {
    const svg = getBarcodeSvgString("FS-HK-CHOP12-001");
    expect(svg).toBeTypeOf("string");
    expect(svg.length).toBeGreaterThan(50);
    expect(svg).toContain("FS-HK-CHOP12-001");
  });

  it("should handle empty or whitespace inputs gracefully", () => {
    const svg = getBarcodeSvgString("   ");
    expect(svg).toContain("Invalid Barcode");
  });
});

describe("Barcode Resolution Engine (barcodeResolver.ts)", () => {
  const mockProducts: Product[] = [
    {
      _id: "prod_001",
      title: "Handheld Electric Chopper 250ml",
      slug: "handheld-chopper",
      description: "Rechargeable chopper",
      categoryId: "cat_kitchen_tools",
      rating: 4.8,
      reviewCount: 120,
      tags: ["chopper", "kitchen"],
      isActive: true,
      totalStock: 50,
      colorVariants: [
        {
          color: "Emerald Green",
          dimensions: "10x10x15cm",
          images: ["/chopper.png"],
          subVariants: [
            {
              id: "sub_001_green_250",
              size: "250ml",
              weight: "350g",
              mrp: 999,
              b2cPrice: 499,
              b2bPrice: 299,
              dropshippingPrice: 349,
              discount: 0,
              stock: 30,
              sku: "FS-HK-CHOP12-001-GRN",
              barcode: "89000137071"
            },
            {
              id: "sub_001_green_500",
              size: "500ml",
              weight: "500g",
              mrp: 1499,
              b2cPrice: 799,
              b2bPrice: 499,
              dropshippingPrice: 549,
              discount: 0,
              stock: 20,
              sku: "FS-HK-CHOP12-001-GRN-500",
              barcode: "89000137072"
            }
          ]
        },
        {
          color: "Pearl White",
          dimensions: "10x10x15cm",
          images: ["/chopper-white.png"],
          subVariants: [
            {
              id: "sub_001_white_250",
              size: "250ml",
              weight: "350g",
              mrp: 999,
              b2cPrice: 499,
              b2bPrice: 299,
              dropshippingPrice: 349,
              discount: 0,
              stock: 15,
              sku: "FS-HK-CHOP12-001-WHT",
              barcode: "89000137073"
            }
          ]
        }
      ]
    }
  ];

  it("should resolve exact SubVariant SKU match accurately", () => {
    const res = resolveBarcode("FS-HK-CHOP12-001-WHT", mockProducts, "B2B");
    expect(res.success).toBe(true);
    expect(res.matchType).toBe("subvariant_sku");
    expect(res.product?.title).toBe("Handheld Electric Chopper 250ml");
    expect(res.colorVariant?.color).toBe("Pearl White");
    expect(res.subVariant?.sku).toBe("FS-HK-CHOP12-001-WHT");
    expect(res.matchedPrice).toBe(299);
    expect(res.availableStock).toBe(15);
  });

  it("should resolve exact SubVariant barcode number match", () => {
    const res = resolveBarcode("89000137072", mockProducts, "B2C");
    expect(res.success).toBe(true);
    expect(res.matchType).toBe("subvariant_barcode");
    expect(res.colorVariant?.color).toBe("Emerald Green");
    expect(res.subVariant?.size).toBe("500ml");
    expect(res.matchedPrice).toBe(799);
  });

  it("should resolve product ID match fallback", () => {
    const res = resolveBarcode("prod_001", mockProducts, "Dropshipping");
    expect(res.success).toBe(true);
    expect(res.matchType).toBe("product_id");
    expect(res.matchedPrice).toBe(349);
  });

  it("should return success: false for non-existent SKUs", () => {
    const res = resolveBarcode("UNKNOWN-SKU-999", mockProducts);
    expect(res.success).toBe(false);
    expect(res.matchType).toBe("none");
    expect(res.error).toContain("UNKNOWN-SKU-999");
  });
});
