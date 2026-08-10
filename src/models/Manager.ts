import mongoose, { Schema, Document } from "mongoose";

export interface ManagerLoginHistoryItem {
  loginTime: Date;
  logoutTime?: Date;
  logoutReason?: "manual" | "auto_10pm" | "expired";
  ipAddress?: string;
}

export interface IManager extends Document {
  name: string;
  email: string;
  password?: string;
  assignedRole?: string;
  permissions: string[];
  lastLogin?: Date;
  lastLogout?: Date;
  loginHistory?: ManagerLoginHistoryItem[];
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const ManagerSchema = new Schema<IManager>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Hashed password, only modifiable by admin
    assignedRole: { type: String, default: "Staff Manager" },
    permissions: { type: [String], default: [] },
    lastLogin: { type: Date },
    lastLogout: { type: Date },
    loginHistory: [
      {
        loginTime: { type: Date, required: true },
        logoutTime: { type: Date },
        logoutReason: { type: String, enum: ["manual", "auto_10pm", "expired"], default: "manual" },
        ipAddress: { type: String },
      },
    ],
    status: { type: String, enum: ["active", "suspended"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.models.Manager || mongoose.model<IManager>("Manager", ManagerSchema);
