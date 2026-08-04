import mongoose, { Schema, Document } from "mongoose";
import { Notification as NotificationType } from "@/types";

const NotificationSchema = new Schema<NotificationType & Document>(
  {
    customerId: { type: String, required: true, index: true },
    recipientRole: { type: String, enum: ["customer", "admin", "manager"], default: "customer", index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["info", "order", "success", "warning", "security"], default: "info" },
    isRead: { type: Boolean, default: false, index: true },
    link: { type: String },
    actionType: { type: String },
    entityId: { type: String }
  },
  { timestamps: true }
);

// TTL index to automatically delete notifications after 30 days (2592000 seconds)
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);
