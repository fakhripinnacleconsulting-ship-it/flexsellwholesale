import mongoose, { Schema, Document } from "mongoose";
import { HsnRecord as HsnRecordType } from "@/types";

const HsnRecordSchema = new Schema<HsnRecordType & Document>(
  {
    _id: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    gstRate: { type: Number, required: true },
    description: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.HsnRecord || mongoose.model("HsnRecord", HsnRecordSchema);
