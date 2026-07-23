import mongoose, { Schema, Document } from "mongoose";

export interface INotificationPreference extends Document {
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  categories: {
    orders: boolean;
    shipments: boolean;
    payments: boolean;
    quotes: boolean;
    invoices: boolean;
    security: boolean;
    system: boolean;
  };
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    emailNotifications: { type: Boolean, default: true },
    pushNotifications: { type: Boolean, default: true },
    categories: {
      orders: { type: Boolean, default: true },
      shipments: { type: Boolean, default: true },
      payments: { type: Boolean, default: true },
      quotes: { type: Boolean, default: true },
      invoices: { type: Boolean, default: true },
      security: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.models.NotificationPreference ||
  mongoose.model<INotificationPreference>("NotificationPreference", NotificationPreferenceSchema);
