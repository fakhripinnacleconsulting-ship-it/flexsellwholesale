import { ShippingConfig } from "@/types";
import { apiClient } from "@/lib/apiClient";

export const shippingService = {
  async getConfig(): Promise<ShippingConfig> {
    return apiClient.get<ShippingConfig>("/shipping");
  },

  async updateConfig(data: ShippingConfig): Promise<ShippingConfig> {
    return apiClient.put<ShippingConfig>("/shipping", data);
  },

};
