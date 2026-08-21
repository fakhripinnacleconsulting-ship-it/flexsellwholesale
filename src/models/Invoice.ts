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
  legalName: { type: String },
  gstin: { type: String, default: "" },
  pan: { type: String },
  cin: { type: String },
  address: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  logoUrl: { type: String },
  signatureUrl: { type: String },
  bankDetails: {
    bankName: { type: String },
    accountName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    branchName: { type: String },
  },
  termsAndConditions: [{ type: String }],
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
    dropshipDetails: {
      amazonOrderId: { type: String },
      amazonInvoiceId: { type: String },
      amazonInvoiceDate: { type: String },
      customerName: { type: String },
      address: { type: String },
      addressLine2: { type: String },
      city: { type: String },
      state: { type: String },
      pinCode: { type: String },
      mobileNumber: { type: String },
      email: { type: String },
      deliveryDate: { type: String },
      amazonTaxInvoice: { type: String },
      amazonPackingSlip: { type: String },
    },
    paymentMethod: { type: String },
    paymentStatus: { type: String },
    transactionId: { type: String },

    /**
     * Settlement links, in both directions.
     *
     * A paid receipt is no longer mutated into an invoice — `_id` is an assigned String and
     * MongoDB will not change it, so that produced Tax Invoices numbered `REC-…`. Settlement
     * now issues a separate `INV-` document and the two point at each other, which also
     * keeps the receipt available as the audit record of what was collected.
     */
    sourceReceiptId: { type: String },
    settledByInvoiceId: { type: String },

    /**
     * The ledger row that paid this document, when a Advance Balance paid it.
     *
     * Without this a wallet-settled invoice has no pointer into AdvanceBalanceTransaction, so it can
     * neither be reconciled nor reversed.
     */
    walletTransactionId: { type: String },
    walletType: { type: String, enum: ["store", "business"] },

    sellerInfo: { type: SellerInfoSchema, required: true },
    notes: { type: String },
    // Display string, in IST. `issuedAt` below is the sortable instant — this stays because
    // it is what the printed document shows.
    generatedAt: { type: String, required: true },
    /**
     * The instant the document was issued.
     *
     * `generatedAt` is a formatted string, so date-range queries and reporting had to fall
     * back to `createdAt` — which is the row's creation time, not the document's issue date.
     * They differ for anything backfilled or migrated.
     */
    issuedAt: { type: Date, default: Date.now },
    generatedBy: { type: String, required: true, default: "system" },
    createdBy: {
      name: { type: String },
      role: { type: String, enum: ["Admin", "Manager", "Customer", "System"], default: "System" },
      email: { type: String },
      userId: { type: String },
    },
    salesperson: { type: String },
    isArchived: { type: Boolean, default: false },
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

InvoiceSchema.index({ orderId: 1, type: 1 });
InvoiceSchema.index({ type: 1 });
InvoiceSchema.index({ orderId: 1 });
InvoiceSchema.index({ customerId: 1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ isArchived: 1 });
InvoiceSchema.index({ createdAt: -1 });
InvoiceSchema.index({ issuedAt: -1 });
InvoiceSchema.index({ customerType: 1 });
InvoiceSchema.index({ "createdBy.userId": 1 });
InvoiceSchema.index({ "createdBy.role": 1 });

/**
 * One invoice per receipt, enforced by the database.
 *
 * The application-level duplicate check this backs up only fired when the receipt had a
 * linked `orderId`, so a standalone receipt could be settled twice by two concurrent
 * requests. A unique index cannot be raced.
 */
InvoiceSchema.index({ sourceReceiptId: 1 }, { unique: true, sparse: true });
InvoiceSchema.index({ walletTransactionId: 1 }, { sparse: true });

if (mongoose.models.Invoice) {
  mongoose.deleteModel("Invoice");
}

export default mongoose.model("Invoice", InvoiceSchema);
