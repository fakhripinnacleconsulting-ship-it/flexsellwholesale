import mongoose, { Schema, Document } from "mongoose";
import { Coupon as CouponType } from "@/types";

const CouponSchema = new Schema<CouponType & Document>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountType: { type: String, enum: ["percentage", "flat"], required: true },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    expiryDate: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isPersonalized: { type: Boolean, default: false },
    allowedCustomers: { type: [String], default: [] },
    usageLimit: { type: Number, default: null },
    usageLimitPerCustomer: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    usedBy: { type: [String], default: [] }
  },
  { timestamps: true }
);

export default mongoose.models.Coupon || mongoose.model("Coupon", CouponSchema);
