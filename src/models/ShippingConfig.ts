import mongoose, { Schema, Document } from "mongoose";
import { ShippingConfig as ShippingConfigType } from "@/types";

const WeightSlabSchema = new Schema({
  fromGram: { type: Number, required: true },
  uptoGram: { type: Number, required: true },
  amount: { type: Number, required: true },
}, { _id: true });

const ShiprocketConfigSchema = new Schema({
  enabled: { type: Boolean, default: false },
  email: { type: String, default: "" },
  password: { type: String, default: "" },
  webhookToken: { type: String, default: "" },
  channelId: { type: String, default: "" },
  pickupAddress: {
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pinCode: { type: String, default: "" },
    country: { type: String, default: "India" },
  },
}, { _id: false });

const ShippingConfigSchema = new Schema<ShippingConfigType & Document>(
  {
    _id: { type: String, default: "shipping-config" },
    weightSlabs: [WeightSlabSchema],
    b2bFixedCharge: { type: Number, default: 150 },
    shiprocket: { type: ShiprocketConfigSchema, default: () => ({}) },
  },
  { timestamps: true }
);

if (mongoose.models.ShippingConfig) {
  delete mongoose.models.ShippingConfig;
}

export default mongoose.models.ShippingConfig ||
  mongoose.model<ShippingConfigType & Document>("ShippingConfig", ShippingConfigSchema);
