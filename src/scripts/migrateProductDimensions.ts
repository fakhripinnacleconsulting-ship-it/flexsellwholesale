import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import dbConnect from "../lib/dbConnect";
import Product from "../models/Product";

export function parseWeightToGrams(weightStr: string): number | null {
  if (!weightStr) return null;
  const clean = weightStr.toLowerCase().trim();
  const match = clean.match(/([0-9.]+)\s*(kg|g|gm|gram|grams)?/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  if (isNaN(num)) return null;
  const unit = match[2];
  if (unit === "kg") {
    return Math.round(num * 1000);
  }
  return Math.round(num);
}

export function parseDimensionsToCm(dimStr: string): { lengthCm: number; breadthCm: number; heightCm: number } | null {
  if (!dimStr) return null;
  const clean = dimStr.toLowerCase().trim();
  // e.g. "15x12x8 cm", "274x274 cm"
  const parts = clean.split(/x|×|\*/).map(p => parseFloat(p.replace(/[^0-9.]/g, "")));
  if (parts.length >= 3 && !parts.slice(0, 3).some(n => isNaN(n) || n <= 0)) {
    return {
      lengthCm: parts[0],
      breadthCm: parts[1],
      heightCm: parts[2],
    };
  } else if (parts.length === 2 && !parts.some(n => isNaN(n) || n <= 0)) {
    return {
      lengthCm: parts[0],
      breadthCm: parts[1],
      heightCm: 1, // Default 1cm thickness for 2D items (bedsheets, apparel)
    };
  }
  return null;
}

async function runMigration() {
  const isDryRun = process.argv.includes("--dry-run");
  console.log(`Starting Product Weight & Dimension Migration... [Dry Run: ${isDryRun}]`);

  await dbConnect();
  const products = await Product.find({});
  const totalProducts = products.length;
  let updatedCount = 0;
  let errorCount = 0;

  for (const product of products) {
    let isModified = false;

    if (product.colorVariants && Array.isArray(product.colorVariants)) {
      for (const cv of product.colorVariants) {
        // Backfill dimensions if missing
        if ((cv.lengthCm === undefined || cv.lengthCm === null) && cv.dimensions) {
          const parsed = parseDimensionsToCm(cv.dimensions);
          if (parsed) {
            cv.lengthCm = parsed.lengthCm;
            cv.breadthCm = parsed.breadthCm;
            cv.heightCm = parsed.heightCm;
            isModified = true;
          } else {
            console.warn(`[WARN] Product "${product.title}" (${product._id}), Color "${cv.color}": Failed to parse dimensions "${cv.dimensions}"`);
            errorCount++;
          }
        }

        // Backfill weight for subvariants
        if (cv.subVariants && Array.isArray(cv.subVariants)) {
          for (const sv of cv.subVariants) {
            if ((sv.weightGrams === undefined || sv.weightGrams === null) && sv.weight) {
              const parsedWeight = parseWeightToGrams(sv.weight);
              if (parsedWeight !== null) {
                sv.weightGrams = parsedWeight;
                isModified = true;
              } else {
                console.warn(`[WARN] Product "${product.title}" (${product._id}), Variant SKU "${sv.sku}": Failed to parse weight "${sv.weight}"`);
                errorCount++;
              }
            }
          }
        }
      }
    }

    if (isModified) {
      updatedCount++;
      if (!isDryRun) {
        await product.save();
      }
    }
  }

  console.log(`\n--- Migration Summary ---`);
  console.log(`Total Products Scanned: ${totalProducts}`);
  console.log(`Products Updated: ${updatedCount}`);
  console.log(`Parsing Warnings/Errors: ${errorCount}`);
  if (isDryRun) {
    console.log(`[DRY RUN COMPLETE - No changes saved to DB]`);
  } else {
    console.log(`[MIGRATION COMPLETE - Changes persisted to DB]`);
  }
  process.exit(0);
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
