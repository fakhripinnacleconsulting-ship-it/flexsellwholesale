import mongoose, { Schema, Document } from "mongoose";
import { Category as CategoryType } from "@/types";

const CategorySchema = new Schema<CategoryType & Document>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: { type: String, default: "" },
    description: { type: String },
    parentId: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Category || mongoose.model("Category", CategorySchema);
