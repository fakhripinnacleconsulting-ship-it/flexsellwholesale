import { ShippingConfig } from "@/types";
import { apiClient } from "@/lib/apiClient";

export const shippingService = {
  async getConfig(): Promise<ShippingConfig> {
    return apiClient.get<ShippingConfig>("/shipping");
  },

  async updateConfig(data: ShippingConfig): Promise<ShippingConfig> {
    return apiClient.put<ShippingConfig>("/shipping", data);
  },

  async getShiprocketStatus(): Promise<{ enabled: boolean; configured: boolean }> {
    try {
      const config = await this.getConfig();
      const sr = config?.shiprocket;
      const enabled = Boolean(sr?.enabled);
      const configured = Boolean(sr?.email && (sr?.password || process.env.SHIPROCKET_PASSWORD));
      return { enabled, configured };
    } catch {
      return { enabled: false, configured: false };
    }
  }
};
