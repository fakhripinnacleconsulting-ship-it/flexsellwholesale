import mongoose, { Schema, Document } from "mongoose";

export interface IOtpVerification extends Document {
  email: string;
  otpHash: string;
  registrationData: string;
  attempts: number;
  resendAfter: Date;
  expiresAt: Date;
}

const OtpVerificationSchema = new Schema<IOtpVerification>(
  {
    email: { type: String, required: true, unique: true, index: true },
    otpHash: { type: String, required: true },
    registrationData: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    resendAfter: { type: Date, required: true },
    expiresAt: { type: Date, required: true, expires: 0 }, // Auto-cleans expired records after 10 minutes
  },
  { timestamps: true }
);

export default mongoose.models.OtpVerification ||
  mongoose.model<IOtpVerification>("OtpVerification", OtpVerificationSchema);
