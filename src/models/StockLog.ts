import mongoose, { Schema } from "mongoose";

const StockLogSchema = new Schema(
  {
    _id: { type: String, required: true },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    variantDetails: { type: String, required: true },
    actionType: { 
      type: String, 
      enum: ["Scan Adjustment", "CSV Bulk Import", "Order Deduction", "Manual Adjustment"], 
      required: true 
    },
    change: { type: Number, required: true },
    prevStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    timestamp: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.StockLog || mongoose.model("StockLog", StockLogSchema);
