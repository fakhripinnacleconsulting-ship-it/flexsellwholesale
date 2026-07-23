import mongoose, { Schema, Document } from "mongoose";
import { Review as ReviewType } from "@/types";

const ReviewSchema = new Schema<ReviewType & Document>(
  {
    productId: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true },
    comment: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminResponse: { type: String }
  },
  { timestamps: true }
);

// Compound index to ensure a customer can only review a product once
ReviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });

export default mongoose.models.Review || mongoose.model("Review", ReviewSchema);
