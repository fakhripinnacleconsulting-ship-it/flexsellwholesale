import mongoose, { Schema, Document } from "mongoose";
import { Order as OrderType } from "@/types";

const ShiprocketOrderSchema = new Schema({
  orderId: { type: Number },
  shipmentId: { type: Number },
  awbCode: { type: String },
  courierId: { type: Number },
  courierName: { type: String },
  labelUrl: { type: String },
  manifestUrl: { type: String },
  pickupScheduledDate: { type: String },
  pickupTokenNumber: { type: String },
  currentStatus: { type: String },
  currentStatusCode: { type: Number },
  etd: { type: String },
  trackingUrl: { type: String },
  fulfillmentStep: { type: String },
  failedAt: { type: String },
  failureReason: { type: String },
}, { _id: false });

const ShipmentDetailsSchema = new Schema({
  type: { type: String, enum: ["self", "third-party", "shiprocket"], required: true },
  carrierName: { type: String },
  trackingId: { type: String, required: true },
  trackingUrl: { type: String },
  shippedAt: { type: String },
  deliveredAt: { type: String },
  estimatedDelivery: { type: String },
  notes: { type: String },
  shiprocket: { type: ShiprocketOrderSchema },
});

const HistoryEventSchema = new Schema({
  status: { type: String, required: true },
  timestamp: { type: String, required: true },
  description: { type: String, required: true },
});

const OrderSchema = new Schema<OrderType & Document>(
  {
    _id: { type: String, required: true },
    date: { type: String, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Placed", "Pending", "Confirmed", "Processing", "Awaiting Shipment", "In Transit", "Shipped", "Delivered", "Cancelled"],
      default: "Processing",
    },
    statusClass: { type: String, required: true },
    itemsCount: { type: Number, required: true },
    customerName: { type: String, required: true },
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
    items: [{ type: Schema.Types.Mixed, required: true }],
    shipmentDetails: { type: ShipmentDetailsSchema },
    history: [HistoryEventSchema],
    paymentMethod: { type: String, enum: ["Bank Transfer", "Razorpay", "UPI", "COD"] },
    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending" },
    transactionId: { type: String },
    invoiceId: { type: String, ref: "Invoice" },
    quoteId: { type: String, ref: "Invoice" },
    salesperson: { type: String },
    couponCode: { type: String },
    couponDiscount: { type: Number },
    orderType: { type: String, enum: ["B2B", "B2C"], default: "B2C", required: true },
    origin: { type: String, enum: ["self", "website"], default: "website", required: true },
  },
  { timestamps: true }
);

OrderSchema.index({ status: 1 });
OrderSchema.index({ customerName: 1 });
OrderSchema.index({ date: -1 });
OrderSchema.index({ quoteId: 1 }, { unique: true, sparse: true });
OrderSchema.index({ orderType: 1 });
OrderSchema.index({ origin: 1 });

if (mongoose.models.Order) {
  mongoose.deleteModel("Order");
}

export default mongoose.model("Order", OrderSchema);
