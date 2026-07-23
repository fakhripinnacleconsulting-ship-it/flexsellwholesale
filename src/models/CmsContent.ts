import mongoose, { Schema, Document } from "mongoose";

export interface ICmsContent extends Document {
  key: string;
  value: any;
}

const CmsContentSchema = new Schema<ICmsContent>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.CmsContent || mongoose.model<ICmsContent>("CmsContent", CmsContentSchema);
