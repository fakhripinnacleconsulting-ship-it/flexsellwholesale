import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import Category from "@/models/Category";
import { generateNextId } from "@/lib/idGeneratorServer";
import HsnRecord from "@/models/HsnRecord";
import { requireAuth } from "@/lib/authGuard";

// Helper to generate a slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const { products: importedProducts } = await request.json();

    if (!Array.isArray(importedProducts)) {
      return NextResponse.json(
        { message: "Invalid payload. 'products' must be an array." },
        { status: 400 }
      );
    }

    // 1. Fetch system categories & HSN records for lookups
    const systemCategories = await Category.find({}).lean();
    const systemHsns = await HsnRecord.find({}).lean();

    const categoryMap = new Map<string, string>(); // Name (lowercase) -> ID
    systemCategories.forEach((c: any) => {
      categoryMap.set(c.name.toLowerCase().trim(), c._id.toString());
      categoryMap.set(c._id.toString().toLowerCase().trim(), c._id.toString());
    });

    const hsnRateMap = new Map<string, number>(); // Code -> GST Rate
    systemHsns.forEach((h: any) => {
      hsnRateMap.set(h.code.trim(), h.gstRate);
    });

    // 2. Fetch all existing products to map for matching
    const existingProductsList = await Product.find({}).lean();
    
    // Lookup Maps
    const existingByTitle = new Map<string, any>(); // Title (lowercase) -> Product
    const skuToProductId = new Map<string, any>(); // SKU (lowercase) -> Product

    existingProductsList.forEach((p: any) => {
      existingByTitle.set(p.title.toLowerCase().trim(), p);
      if (Array.isArray(p.colorVariants)) {
        p.colorVariants.forEach((cv: any) => {
          if (Array.isArray(cv.subVariants)) {
            cv.subVariants.forEach((sv: any) => {
              if (sv.sku) skuToProductId.set(sv.sku.toLowerCase().trim(), p);
            });
          }
        });
      }
    });

    const results = {
      inserted: 0,
      updated: 0,
      errors: [] as string[],
    };

    // 3. Process products in loop
    for (const imported of importedProducts) {
      try {
        if (!imported.title) {
          results.errors.push("Missing product title.");
          continue;
        }

        // Search for matching product in database by Title or any imported variant SKU
        let match: any = null;
        
        // Match by Title first
        const titleKey = imported.title.toLowerCase().trim();
        if (existingByTitle.has(titleKey)) {
          match = existingByTitle.get(titleKey);
        }

        // If no Title match, check if any imported SKU belongs to an existing product
        if (!match && Array.isArray(imported.colorVariants)) {
          for (const cv of imported.colorVariants) {
            if (Array.isArray(cv.subVariants)) {
              for (const sv of cv.subVariants) {
                if (sv.sku) {
                  const skuKey = sv.sku.toLowerCase().trim();
                  if (skuToProductId.has(skuKey)) {
                    match = skuToProductId.get(skuKey);
                    break;
                  }
                }
              }
            }
            if (match) break;
          }
        }

        // Resolve Category ID
        let categoryId = imported.categoryId;
        if (imported.categoryId) {
          const matchedCatId = categoryMap.get(imported.categoryId.toLowerCase().trim());
          if (matchedCatId) {
            categoryId = matchedCatId;
          } else {
            categoryId = systemCategories[0]?._id || "unknown";
          }
        } else {
          categoryId = systemCategories[0]?._id || "unknown";
        }

        // Resolve HSN Code and automatic GST Rate
        const hsnCode = imported.hsnCode || "3924";
        const gstRate = hsnRateMap.get(hsnCode) !== undefined ? hsnRateMap.get(hsnCode) : 18;

        // Auto-generate SEO metadata if blank
        const seoTitle = imported.seoTitle || `${imported.title} | FlexSell B2B Wholesale`;
        const seoDescription = imported.seoDescription || `Buy ${imported.title} in bulk at wholesale price. Premium B2B cargo supply. MOQ: ${imported.moq || 1} units.`;
        const seoKeywords = imported.seoKeywords || `${imported.title.toLowerCase()}, wholesale, B2B cargo`;

        if (match) {
          // UPDATE EXISTING PRODUCT
          const productId = match._id;

          // Map existing sub-variant IDs by SKU to preserve them
          const existingSkuToSubId = new Map<string, string>();
          if (Array.isArray(match.colorVariants)) {
            match.colorVariants.forEach((cv: any) => {
              if (Array.isArray(cv.subVariants)) {
                cv.subVariants.forEach((sv: any) => {
                  if (sv.sku) existingSkuToSubId.set(sv.sku.toLowerCase().trim(), sv.id);
                });
              }
            });
          }

          // Build merged color variants
          const updatedColorVariants = (imported.colorVariants || []).map((cv: any) => {
            const updatedSubVariants = (cv.subVariants || []).map((sv: any) => {
              const skuKey = sv.sku ? sv.sku.toLowerCase().trim() : "";
              const svId = existingSkuToSubId.get(skuKey) || sv.id || `sv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              return {
                ...sv,
                id: svId,
                isActive: sv.isActive !== undefined ? sv.isActive : true // Default is active
              };
            });

            return {
              ...cv,
              subVariants: updatedSubVariants,
            };
          });

          // Calculate total stock
          const totalStock = updatedColorVariants.reduce((sum: number, cv: any) => {
            return sum + (cv.subVariants || []).reduce((subSum: number, sv: any) => subSum + (Number(sv.stock) || 0), 0);
          }, 0);

          const updatedFields = {
            title: imported.title,
            description: imported.description || match.description || "",
            categoryId,
            vendorId: imported.vendorId || match.vendorId,
            tags: imported.tags || match.tags || [],
            cardTags: imported.cardTags || match.cardTags || [],
            isActive: imported.isActive !== undefined ? imported.isActive : true,
            hsnCode,
            gstRate,
            priceIncludesGst: imported.priceIncludesGst !== undefined ? imported.priceIncludesGst : true,
            moq: imported.moq !== undefined ? imported.moq : 1,
            seoTitle,
            seoDescription,
            seoKeywords,
            aPlusContent: imported.aPlusContent || match.aPlusContent || [],
            colorVariants: updatedColorVariants,
            totalStock,
          };

          await Product.findByIdAndUpdate(productId, { $set: updatedFields });
          results.updated++;
        } else {
          // CREATE NEW PRODUCT
          const productId = await generateNextId("product");

          // Resolve slug uniqueness
          let baseSlug = generateSlug(imported.title);
          let uniqueSlug = baseSlug;
          let counter = 1;
          
          const slugExists = async (slugVal: string) => {
            const dbCheck = await Product.findOne({ slug: slugVal }).lean();
            return !!dbCheck;
          };

          while (await slugExists(uniqueSlug)) {
            uniqueSlug = `${baseSlug}-${counter}`;
            counter++;
          }

          // Build new color variants
          const newColorVariants = (imported.colorVariants || []).map((cv: any) => {
            const newSubVariants = (cv.subVariants || []).map((sv: any) => {
              return {
                ...sv,
                id: sv.id || `sv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                isActive: true // Default is active
              };
            });

            return {
              ...cv,
              subVariants: newSubVariants,
            };
          });

          // Calculate total stock
          const totalStock = newColorVariants.reduce((sum: number, cv: any) => {
            return sum + (cv.subVariants || []).reduce((subSum: number, sv: any) => subSum + (Number(sv.stock) || 0), 0);
          }, 0);

          const newProductData = {
            _id: productId,
            title: imported.title,
            slug: uniqueSlug,
            description: imported.description || "",
            categoryId,
            vendorId: imported.vendorId,
            tags: imported.tags || [],
            cardTags: imported.cardTags || [],
            isActive: true, // Default active
            hsnCode,
            gstRate,
            priceIncludesGst: imported.priceIncludesGst !== undefined ? imported.priceIncludesGst : true,
            moq: imported.moq !== undefined ? imported.moq : 1,
            seoTitle,
            seoDescription,
            seoKeywords,
            fieldVisibility: {
              showDescription: true,
              showSizes: true,
              showWeights: true,
              showDimensions: true,
              showImages: true,
            },
            colorVariants: newColorVariants,
            aPlusContent: imported.aPlusContent || [],
            totalStock,
          };

          await Product.create(newProductData);
          results.inserted++;
        }
      } catch (err: unknown) {
        results.errors.push(`Product "${imported.title}": ${(err as any).message || err}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: results,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to process bulk upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { message: "Invalid payload. 'ids' must be a non-empty array." },
        { status: 400 }
      );
    }

    const deleteResult = await Product.deleteMany({ _id: { $in: ids } });
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} products in bulk.`,
      deletedCount: deleteResult.deletedCount
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to bulk delete products" },
      { status: 500 }
    );
  }
}
