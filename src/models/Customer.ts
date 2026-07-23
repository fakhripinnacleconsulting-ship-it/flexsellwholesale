import mongoose, { Schema, Document } from "mongoose";
import { Customer as CustomerType } from "@/types";

const SavedAddressSchema = new Schema({
  name: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  company: { type: String },
  address: { type: String, required: true },
  apartment: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pinCode: { type: String, required: true },
  phone: { type: String, required: true },
  gstin: { type: String },
  isDefault: { type: Boolean, default: false }
});

const CustomerSchema = new Schema<CustomerType & Document>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    role: { type: String, enum: ["customer", "admin"], default: "customer" },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    company: { type: String },
    address: { type: String, required: false },
    city: { type: String, required: false },
    state: { type: String, required: false },
    pinCode: { type: String, required: false },
    phone: { type: String, required: true },
    initials: { type: String, required: true },
    gstin: { type: String },
    customerTypes: {
      type: [{ type: String, enum: ["B2C", "B2B", "Dropshipping"] }],
      default: ["B2C"]
    },
    addresses: [SavedAddressSchema],
    wishlist: [{ type: String }]
  },
  { timestamps: true }
);

// Standard Next.js hot-reload model caching pattern
export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);
