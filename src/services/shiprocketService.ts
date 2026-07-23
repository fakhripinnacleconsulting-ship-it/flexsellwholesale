import { apiClient, isMockMode } from "@/lib/apiClient";

const SHIPROCKET_STORAGE_KEY = "flexsell-shiprocket-storage";

function getLocalShiprocketConfig() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SHIPROCKET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {
      enabled: true,
      email: "mock-admin@flexsell.in",
      password: "••••••••",
      webhookToken: "mock-webhook-token-12345",
      channelId: "102938",
      pickupAddress: {
        name: "FlexSell Surat Central Warehouse",
        phone: "9876543210",
        address: "Plot 12, GIDC Sachin",
        city: "Surat",
        state: "Gujarat",
        pinCode: "395003",
        country: "India"
      }
    };
  } catch {
    return null;
  }
}

function saveLocalShiprocketConfig(config: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHIPROCKET_STORAGE_KEY, JSON.stringify(config));
}

export const shiprocketService = {
  async getConfig() {
    if (isMockMode) {
      return getLocalShiprocketConfig();
    }
    return apiClient.get("/shiprocket/config");
  },

  async updateConfig(data: any) {
    if (isMockMode) {
      const current = getLocalShiprocketConfig() || {};
      const updated = { ...current, ...data };
      saveLocalShiprocketConfig(updated);
      return updated;
    }
    return apiClient.put("/shiprocket/config", data);
  },

  async testConnection(data?: any) {
    if (isMockMode) {
      return {
        authOk: true,
        channelOk: true,
        pickupOk: true,
        error: null
      };
    }
    return apiClient.post("/shiprocket/config", data);
  },

  async checkServiceability(params: { pickupPinCode?: string; deliveryPinCode: string; weight: number; isCod?: boolean }) {
    if (isMockMode) {
      return {
        status: 200,
        data: {
          available_courier_companies: [
            {
              courier_company_id: 1,
              courier_name: "BlueDart Surface Express",
              rate: 145,
              etd: "2-3 Days",
              cod: 1,
            },
            {
              courier_company_id: 10,
              courier_name: "Delhivery Surface 5kg",
              rate: 110,
              etd: "3-4 Days",
              cod: 1,
            },
            {
              courier_company_id: 42,
              courier_name: "DTDC Express Cargo",
              rate: 180,
              etd: "1-2 Days",
              cod: 1,
            }
          ]
        }
      };
    }
    return apiClient.post("/shiprocket/serviceability", params);
  },

  async fulfillOrder(orderId: string, courierId?: number) {
    if (isMockMode) {
      const mockAwb = `SR-AWB-${Math.floor(10000000 + Math.random() * 90000000)}`;
      return {
        success: true,
        order: {
          _id: orderId,
          status: "Awaiting Shipment",
          shipmentDetails: {
            type: "shiprocket",
            carrierName: courierId === 10 ? "Delhivery Surface 5kg" : "BlueDart Surface Express",
            trackingId: mockAwb,
            trackingUrl: `https://shiprocket.co/tracking/${mockAwb}`,
            shippedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
            shiprocket: {
              orderId: 998877,
              shipmentId: 887766,
              awbCode: mockAwb,
              courierId: courierId || 1,
              courierName: courierId === 10 ? "Delhivery Surface 5kg" : "BlueDart Surface Express",
              trackingUrl: `https://shiprocket.co/tracking/${mockAwb}`,
              fulfillmentStep: "complete",
              currentStatus: "AWAITING PICKUP"
            }
          }
        }
      };
    }
    return apiClient.post("/shiprocket/fulfill", { orderId, courierId });
  },

  async retryFulfillment(orderId: string, courierId?: number) {
    if (isMockMode) {
      return this.fulfillOrder(orderId, courierId);
    }
    return apiClient.put("/shiprocket/fulfill", { orderId, courierId });
  },

  async getTracking(orderId: string) {
    if (isMockMode) {
      return {
        hasShiprocket: true,
        liveTracking: {
          track_status: 1,
          shipment_status: "IN TRANSIT",
          shipment_track_activities: [
            { date: "2026-07-23 09:30:00", activity: "Out for delivery", location: "Surat Central Hub" },
            { date: "2026-07-22 18:15:00", activity: "In Transit from Ahmedabad Sorting Facility", location: "Ahmedabad" },
            { date: "2026-07-22 10:00:00", activity: "Picked up by Courier", location: "Surat Warehouse" }
          ]
        }
      };
    }
    return apiClient.get(`/shiprocket/tracking/${orderId}`);
  },

  async cancelShiprocketOrder(orderId: string) {
    if (isMockMode) {
      return { message: "Shiprocket booking cancelled in mock mode" };
    }
    return apiClient.post("/shiprocket/cancel", { orderId });
  },

  async getLabelUrl(orderId: string) {
    if (isMockMode) {
      return { labelUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" };
    }
    return apiClient.get(`/shiprocket/label/${orderId}`);
  }
};
