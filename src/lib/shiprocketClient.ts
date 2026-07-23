import dbConnect from "@/lib/dbConnect";
import ShippingConfig from "@/models/ShippingConfig";
import { decryptPassword } from "@/lib/cryptoHelper";

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

interface ShiprocketCredentials {
  email: string;
  password?: string;
  channelId?: string;
  webhookToken?: string;
  pickupAddress?: {
    name?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    country?: string;
  };
}

export async function getShiprocketCredentials(): Promise<ShiprocketCredentials> {
  await dbConnect();
  const config = await ShippingConfig.findOne({ _id: "shipping-config" }).lean() as any;
  const srConfig = config?.shiprocket;

  const email = srConfig?.email || process.env.SHIPROCKET_EMAIL || "";
  const encryptedPass = srConfig?.password;
  const rawPassword = encryptedPass ? decryptPassword(encryptedPass) : (process.env.SHIPROCKET_PASSWORD || "");
  const channelId = srConfig?.channelId || process.env.SHIPROCKET_CHANNEL_ID || "";
  const webhookToken = srConfig?.webhookToken || process.env.SHIPROCKET_WEBHOOK_TOKEN || "";
  const pickupAddress = srConfig?.pickupAddress;

  return {
    email,
    password: rawPassword,
    channelId,
    webhookToken,
    pickupAddress
  };
}

export async function getShiprocketToken(forceRefresh: boolean = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const creds = await getShiprocketCredentials();
  if (!creds.email || !creds.password) {
    throw new Error("Shiprocket credentials not configured. Please set them in Shipping Settings or environment variables.");
  }

  try {
    const res = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: creds.email,
        password: creds.password,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.token) {
      cachedToken = null;
      tokenExpiresAt = 0;
      throw new Error(data.message || `Shiprocket authentication failed (Status ${res.status})`);
    }

    cachedToken = String(data.token);
    tokenExpiresAt = now + 9.5 * 24 * 60 * 60 * 1000;
    return cachedToken;
  } catch (err: any) {
    cachedToken = null;
    tokenExpiresAt = 0;
    throw err;
  }
}

async function shiprocketFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getShiprocketToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${SHIPROCKET_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `Shiprocket API error: ${res.statusText}`);
  }
  return data as T;
}

export const shiprocketClient = {
  getCredentials: getShiprocketCredentials,
  getToken: getShiprocketToken,

  async checkServiceability(params: {
    pickupPinCode: string;
    deliveryPinCode: string;
    weight: number; // in kg
    isCod?: boolean;
  }) {
    const creds = await getShiprocketCredentials();
    const query = new URLSearchParams({
      pickup_postcode: params.pickupPinCode || creds.pickupAddress?.pinCode || "",
      delivery_postcode: params.deliveryPinCode,
      weight: params.weight.toString(),
      cod: params.isCod ? "1" : "0",
    });

    return shiprocketFetch(`/courier/serviceability/?${query.toString()}`);
  },

  async createAdhocOrder(orderData: any) {
    // Validate numeric weight and dimensions on items before payload creation
    const missingItems: Array<{ title: string; variant: string; missing: string[] }> = [];
    
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const missing: string[] = [];
        if (!item.weightGrams || Number(item.weightGrams) <= 0) missing.push("weightGrams");
        if (!item.lengthCm || Number(item.lengthCm) <= 0) missing.push("lengthCm");
        if (!item.breadthCm || Number(item.breadthCm) <= 0) missing.push("breadthCm");
        if (!item.heightCm || Number(item.heightCm) <= 0) missing.push("heightCm");

        if (missing.length > 0) {
          missingItems.push({
            title: item.title || "Product",
            variant: `${item.color || ''} ${item.size || ''}`.trim() || "Default",
            missing
          });
        }
      }
    }

    if (missingItems.length > 0) {
      const details = missingItems.map(m => `'${m.title}' (${m.variant}): missing ${m.missing.join(", ")}`).join("; ");
      throw new Error(`Cannot create Shiprocket order. Missing numeric package specs: ${details}. Please update the product specs in admin.`);
    }

    return shiprocketFetch("/orders/create/adhoc", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  },

  async assignAwb(shipmentId: number, courierId?: number) {
    const body: Record<string, any> = { shipment_id: shipmentId };
    if (courierId) {
      body.courier_id = courierId;
    }
    return shiprocketFetch("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async schedulePickup(shipmentId: number | number[], pickupDate?: string) {
    const shipment_id = Array.isArray(shipmentId) ? shipmentId : [shipmentId];
    const body: Record<string, any> = { shipment_id };
    if (pickupDate) {
      body.pickup_date = [pickupDate];
    }
    return shiprocketFetch("/pickup/schedule", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async getTracking(shipmentId: number | string) {
    return shiprocketFetch(`/courier/track/shipment/${shipmentId}`);
  },

  async generateLabel(shipmentIds: number[]) {
    return shiprocketFetch("/courier/generate/label", {
      method: "POST",
      body: JSON.stringify({ shipment_id: shipmentIds }),
    });
  },

  async generateManifest(shipmentIds: number[]) {
    return shiprocketFetch("/manifests/generate", {
      method: "POST",
      body: JSON.stringify({ shipment_id: shipmentIds }),
    });
  },

  async cancelOrder(orderIds: number[]) {
    return shiprocketFetch("/orders/cancel", {
      method: "POST",
      body: JSON.stringify({ ids: orderIds }),
    });
  }
};
