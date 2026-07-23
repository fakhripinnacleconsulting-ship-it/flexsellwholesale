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
  const counterExist = await Counter.findById(counterId);

  let currentSeq = currentSetting.startCount;
  if (!counterExist) {
    await Counter.create({ _id: counterId, seq: currentSeq });
  } else {
    const result = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true }
    );
    currentSeq = result.seq;
  }

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
