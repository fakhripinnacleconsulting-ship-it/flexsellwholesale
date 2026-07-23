import mongoose, { Schema, Document } from "mongoose";
import { Invoice as InvoiceType } from "@/types";

const HsnSlabSchema = new Schema({
  hsnCode: { type: String, required: true },
  gstRate: { type: Number, required: true },
  baseAmount: { type: Number, required: true },
  totalTax: { type: Number, required: true },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
}, { _id: false });

const TaxBreakdownSchema = new Schema({
  isIntrastate: { type: Boolean, required: true },
  baseSubtotal: { type: Number, required: true },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  hsnSlabs: [HsnSlabSchema],
}, { _id: false });

const SellerInfoSchema = new Schema({
  storeName: { type: String, required: true },
  gstin: { type: String, default: "" },
  address: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  logoUrl: { type: String },
}, { _id: false });

const InvoiceSchema = new Schema<InvoiceType & Document>(
  {
    _id: { type: String, required: true },
    type: { type: String, enum: ["invoice", "receipt", "quote"], required: true },
    orderId: { type: String, ref: "Order" },
    customerId: { type: String, ref: "Customer" },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerGstin: { type: String },
    items: [{ type: Schema.Types.Mixed, required: true }],
    amount: { type: Number, required: true },
    taxDetails: { type: TaxBreakdownSchema, required: true },
    shippingAddress: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      company: { type: String },
      address: { type: String, required: true },
      apartment: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pinCode: { type: String, required: true },
      phone: { type: String, required: true },
      gstin: { type: String },
    },
    paymentMethod: { type: String },
    paymentStatus: { type: String },
    transactionId: { type: String },
    sellerInfo: { type: SellerInfoSchema, required: true },
    notes: { type: String },
    generatedAt: { type: String, required: true },
    generatedBy: { type: String, required: true, default: "system" },
    salesperson: { type: String },
    isArchived: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      required: true,
      validate: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validator: function(this: any, val: string) {
          let type = this.type;
          if (!type && typeof this.getUpdate === "function") {
            const update = this.getUpdate();
            type = update?.$set?.type || update?.type;
          }
          if (!type) {
            return true;
          }
          if (type === "quote") {
            return ["draft", "finalized", "sent", "accepted", "rejected", "expired", "converted", "cancelled"].includes(val);
          } else if (type === "receipt") {
            return ["pending", "failed", "cancelled", "refunded", "paid"].includes(val);
          } else if (type === "invoice") {
            return ["paid", "void", "archived"].includes(val);
          }
          return false;
        },
        message: (props: { value: string }) => `Invalid status "${props.value}" for document type.`
      }
    },
    couponCode: { type: String },
    couponDiscount: { type: Number },
    customerType: { type: String, enum: ["B2C", "B2B", "Dropshipping"], default: "B2C", required: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ type: 1 });
InvoiceSchema.index({ orderId: 1 });
InvoiceSchema.index({ customerId: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ isArchived: 1 });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ customerType: 1 });

if (mongoose.models.Invoice) {
  mongoose.deleteModel("Invoice");
}

export default mongoose.model("Invoice", InvoiceSchema);
