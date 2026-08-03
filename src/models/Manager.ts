import mongoose, { Schema, Document } from "mongoose";

export interface IManager extends Document {
  name: string;
  email: string;
  password?: string;
  permissions: string[];
  lastLogin?: Date;
  lastLogout?: Date;
  status: "active" | "suspended";
  createdAt: Date;
  updatedAt: Date;
}

const ManagerSchema = new Schema<IManager>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Hashed password, only modifiable by admin
    permissions: { type: [String], default: [] },
    lastLogin: { type: Date },
    lastLogout: { type: Date },
    status: { type: String, enum: ["active", "suspended"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.models.Manager || mongoose.model<IManager>("Manager", ManagerSchema);
