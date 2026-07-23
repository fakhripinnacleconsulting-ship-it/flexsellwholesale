import { HsnRecord } from "@/types";
import { apiClient } from "@/lib/apiClient";

export const hsnService = {
  async getHsnRecords(): Promise<HsnRecord[]> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const HsnRecordModel = (await import("@/models/HsnRecord")).default;
      const records = await HsnRecordModel.find({}).lean();
      return JSON.parse(JSON.stringify(records));
    }
    return apiClient.get<HsnRecord[]>("/hsn");
  },

  async createHsnRecord(
    hsnData: Omit<HsnRecord, "_id" | "createdAt" | "updatedAt">
  ): Promise<HsnRecord> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const HsnRecordModel = (await import("@/models/HsnRecord")).default;
      const record = await HsnRecordModel.create({
        ...hsnData,
        _id: `hsn_${Math.random().toString(36).substring(2, 9)}`
      });
      return JSON.parse(JSON.stringify(record));
    }
    return apiClient.post<HsnRecord>("/hsn", hsnData);
  },

  async updateHsnRecord(
    id: string,
    updatedFields: Partial<HsnRecord>
  ): Promise<HsnRecord> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const HsnRecordModel = (await import("@/models/HsnRecord")).default;
      const record = await HsnRecordModel.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true }
      ).lean();
      if (!record) throw new Error("HSN record not found");
      return JSON.parse(JSON.stringify(record));
    }
    return apiClient.put<HsnRecord>(`/hsn/${id}`, updatedFields);
  },

  async deleteHsnRecord(id: string): Promise<void> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const HsnRecordModel = (await import("@/models/HsnRecord")).default;
      await HsnRecordModel.findByIdAndDelete(id);
      return;
    }
    return apiClient.delete<void>(`/hsn/${id}`);
  }
};
