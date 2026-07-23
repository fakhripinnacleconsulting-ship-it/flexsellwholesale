import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import dbConnect from "../lib/dbConnect";
import ShippingConfig from "../models/ShippingConfig";
import { encryptPassword } from "../lib/cryptoHelper";

async function seedShiprocket() {
  console.log("Seeding Shiprocket default configuration into database...");
  await dbConnect();

  let config = await ShippingConfig.findOne({ _id: "shipping-config" });
  if (!config) {
    config = new ShippingConfig({ _id: "shipping-config" });
  }

  const email = process.env.SHIPROCKET_EMAIL || "k6263638053@gmail.com";
  const password = process.env.SHIPROCKET_PASSWORD || "05^zV!bEH2nSBD#q%#osx1LKT1OnNIry";
  const webhookToken = process.env.SHIPROCKET_WEBHOOK_TOKEN || "flexsell_shiprocket_webhook_secret_2026";

  config.shiprocket = {
    enabled: true,
    email: email,
    password: encryptPassword(password),
    webhookToken: webhookToken,
    channelId: process.env.SHIPROCKET_CHANNEL_ID || "",
    pickupAddress: {
      name: "FlexSell Central Warehouse",
      phone: "6263638053",
      address: "Plot 12, GIDC Industrial Estate, Sachin",
      city: "Surat",
      state: "Gujarat",
      pinCode: "395003",
      country: "India"
    }
  };

  await config.save();
  console.log("✅ Shiprocket configuration successfully seeded into MongoDB!");
  console.log(`Email: ${email}`);
  console.log("Status: ENABLED");
  process.exit(0);
}

seedShiprocket().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
