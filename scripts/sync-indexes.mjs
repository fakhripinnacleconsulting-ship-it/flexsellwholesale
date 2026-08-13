/**
 * Creates every index declared in the Mongoose schemas.
 *
 * Required because dbConnect sets `autoIndex: false` in production — without that,
 * every serverless cold start re-issued createIndex for all 18 models. Run this once
 * after any schema index change, and after the first deploy that disables autoIndex.
 *
 *   node scripts/sync-indexes.mjs
 *
 * Reads MONGODB_URI from the environment (.env.production for the live cluster).
 * Safe to re-run: createIndexes is idempotent for indexes that already exist.
 */

import mongoose from "mongoose";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  if (process.env.MONGODB_URI) return;
  for (const file of [".env.production", ".env.local", ".env"]) {
    try {
      const content = readFileSync(join(root, file), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*MONGODB_URI\s*=\s*"?([^"\r\n]+)"?\s*$/);
        if (match) {
          process.env.MONGODB_URI = match[1];
          console.log(`Using MONGODB_URI from ${file}`);
          return;
        }
      }
    } catch {
      // file absent — try the next one
    }
  }
}

async function main() {
  loadEnv();

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Export it or add it to .env.production.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { family: 4, autoIndex: false });
  console.log(`Connected to ${mongoose.connection.name}\n`);

  // Register every model by importing the compiled schema modules.
  const modelsDir = join(root, "src", "models");
  const modelFiles = readdirSync(modelsDir).filter((f) => f.endsWith(".ts"));

  console.warn(
    `Found ${modelFiles.length} model files. This script needs them as JS — run it against\n` +
    `a built output, or use "npx tsx scripts/sync-indexes.mjs" so the .ts imports resolve.\n`
  );

  for (const file of modelFiles) {
    const name = file.replace(/\.ts$/, "");
    try {
      await import(`../src/models/${file}`);
      console.log(`  registered ${name}`);
    } catch (err) {
      console.error(`  FAILED to register ${name}: ${err.message}`);
    }
  }

  console.log("\nBuilding indexes...");
  const results = [];
  for (const [name, model] of Object.entries(mongoose.models)) {
    try {
      await model.createIndexes();
      const indexes = await model.collection.indexes();
      results.push({ model: name, indexes: indexes.length, status: "ok" });
    } catch (err) {
      results.push({ model: name, indexes: 0, status: `ERROR: ${err.message}` });
    }
  }

  console.table(results);

  const failed = results.filter((r) => r.status !== "ok");
  await mongoose.disconnect();

  if (failed.length > 0) {
    console.error(`\n${failed.length} model(s) failed. Do NOT deploy autoIndex:false until these pass.`);
    process.exit(1);
  }

  console.log("\nAll indexes present. Safe to run with autoIndex disabled.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
