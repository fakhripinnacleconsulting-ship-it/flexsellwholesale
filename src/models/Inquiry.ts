import mongoose, { Schema, Document } from "mongoose";

export interface IInquiry extends Document {
  category: "wholesale" | "dropshipping" | "support" | "franchise" | "general";
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  adminNotes?: string;
  expectedOrders?: string;
  productInterests?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const InquirySchema = new Schema<IInquiry>(
  {
    category: {
      type: String,
      enum: ["wholesale", "dropshipping", "support", "franchise", "general"],
      default: "general",
      required: true
    },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    company: { type: String },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "in_progress", "resolved", "closed"],
      default: "new",
      required: true
    },
    adminNotes: { type: String },
    expectedOrders: { type: String },
    productInterests: [{ type: String }]
  },
  { timestamps: true }
);

export default mongoose.models.Inquiry || mongoose.model<IInquiry>("Inquiry", InquirySchema);
