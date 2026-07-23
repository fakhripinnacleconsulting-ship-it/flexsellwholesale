import mongoose, { Schema, Document } from "mongoose";
import { Collection as CollectionType } from "@/types";

const ConditionSchema = new Schema({
  field: { 
    type: String, 
    enum: ["tag", "category", "price", "title", "stock", "vendor"], 
    required: true 
  },
  operator: { 
    type: String, 
    enum: ["equals", "not_equals", "contains", "starts_with", "greater_than", "less_than"], 
    required: true 
  },
  value: { type: String, required: true },
});

const CollectionRulesSchema = new Schema({
  matchType: { type: String, enum: ["all", "any"], default: "all" },
  conditions: [ConditionSchema],
});

const CollectionSchema = new Schema<CollectionType & Document>(
  {
    _id: { type: String, required: true },
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    type: { type: String, enum: ["manual", "smart"], default: "manual", required: true },
    image: { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    productIds: [{ type: String }],
    rules: { type: CollectionRulesSchema, default: null },
    linkedCategoryIds: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
    seoTitle: { type: String },
    seoDescription: { type: String },
    seoKeywords: { type: String },
  },
  { timestamps: true }
);

CollectionSchema.index({ isActive: 1 });
CollectionSchema.index({ isFeatured: 1 });
CollectionSchema.index({ order: 1 });

export default mongoose.models.Collection || mongoose.model("Collection", CollectionSchema);
