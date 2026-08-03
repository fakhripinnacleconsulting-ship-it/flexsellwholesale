import dbConnect from "./dbConnect";
import CmsContent from "@/models/CmsContent";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import Product from "@/models/Product";
import Invoice from "@/models/Invoice";
import mongoose from "mongoose";
import { DEFAULT_ID_FORMATS, IdFormatConfig, formatIdPreview } from "./idGenerator";

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", CounterSchema);

/**
 * Hands out the next value of a named sequence atomically.
 *
 * `seedIfMissing` supplies the value the sequence should have *before* its first hand-out,
 * and runs only when the counter does not exist yet — that lets a counter be introduced for
 * an ID series that already has documents in the wild without reissuing their numbers.
 *
 * Deliberately runs outside any caller transaction: a counter that rolls back with an
 * aborted transaction would hand the same number to the next caller. Burning a number is
 * the cheaper failure.
 */
export async function nextCounterValue(
  counterId: string,
  seedIfMissing: () => Promise<number>
): Promise<number> {
  const bump = async () =>
    await Counter.findByIdAndUpdate(counterId, { $inc: { seq: 1 } }, { new: true });

  const existing = await bump();
  if (existing) return existing.seq;

  // First use of this counter — seed it, tolerating a concurrent caller doing the same.
  const seed = await seedIfMissing();
  try {
    await Counter.updateOne({ _id: counterId }, { $setOnInsert: { seq: seed } }, { upsert: true });
  } catch (err: unknown) {
    // A concurrent caller seeding the same counter is expected; anything else is not.
    if ((err as { code?: number })?.code !== 11000) throw err;
  }

  const seeded = await bump();
  return seeded ? seeded.seq : seed + 1;
}

async function isIdTaken(type: string, id: string): Promise<boolean> {
  try {
    const modelMap: Record<string, any> = {
      customer: Customer,
      order: Order,
      product: Product,
      invoice: Invoice,
    };
    const targetModel = modelMap[type];
    if (targetModel) {
      const doc = await targetModel.findById(id).select("_id").lean();
      return !!doc;
    }
  } catch {
    // ignore
  }
  return false;
}

export async function generateNextId(type: string): Promise<string> {
  await dbConnect();

  // 1. Read stored ID Formats from CMS Config
  let storedConfig: Record<string, Partial<IdFormatConfig>> = {};
  try {
    const cmsFormats = await CmsContent.findOne({ key: "idFormats" }).lean();
    if (cmsFormats?.value) {
      if (Array.isArray(cmsFormats.value)) {
        cmsFormats.value.forEach((item: any) => {
          if (item?.key) storedConfig[item.key] = item;
        });
      } else if (typeof cmsFormats.value === "object") {
        storedConfig = cmsFormats.value;
      }
    }
  } catch (err) {
    console.warn("Failed to fetch idFormats, using fallback defaults", err);
  }

  // Fallback check to legacy idSettings
  if (Object.keys(storedConfig).length === 0) {
    try {
      const cmsLegacy = await CmsContent.findOne({ key: "idSettings" }).lean();
      const legacy = (cmsLegacy?.value || {}) as any;
      if (legacy.customerPrefix !== undefined) {
        storedConfig.customer = { prefix: legacy.customerPrefix, startCount: parseInt(legacy.customerStart, 10) || 1 };
      }
      if (legacy.orderPrefix !== undefined) {
        storedConfig.order = { prefix: legacy.orderPrefix, startCount: parseInt(legacy.orderStart, 10) || 10026 };
      }
      if (legacy.productPrefix !== undefined) {
        storedConfig.product = { prefix: legacy.productPrefix, startCount: parseInt(legacy.productStart, 10) || 1 };
      }
    } catch {
      // ignore
    }
  }

  const defaultSetting = DEFAULT_ID_FORMATS.find(f => f.key === type) || {
    key: type,
    name: type,
    description: "",
    prefix: `${type.toUpperCase()}-`,
    suffix: "",
    startCount: 1,
    padLength: 4,
    isEnabled: true
  };

  const currentSetting = {
    ...defaultSetting,
    ...(storedConfig[type] || {})
  };

  const counterId = `counter_${type}`;

  // Read-then-create raced: two concurrent registrations both saw "no counter yet", both
  // created it at startCount, and both walked away with the same customer/order id.
  let currentSeq = await nextCounterValue(counterId, async () => currentSetting.startCount - 1);

  let candidateId = formatIdPreview(
    currentSetting.prefix,
    currentSeq,
    currentSetting.padLength,
    currentSetting.suffix,
    !!currentSetting.useHex
  );

  // Auto-advance sequence if ID collision exists in collection
  while (await isIdTaken(type, candidateId)) {
    const result = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true }
    );
    currentSeq = result ? result.seq : currentSeq + 1;
    candidateId = formatIdPreview(
      currentSetting.prefix,
      currentSeq,
      currentSetting.padLength,
      currentSetting.suffix,
      !!currentSetting.useHex
    );
  }

  return candidateId;
}
