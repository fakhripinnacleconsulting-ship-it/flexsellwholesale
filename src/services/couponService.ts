import { Coupon } from "@/types";
import { apiClient, isMockMode } from "@/lib/apiClient";

const COUPONS_STORAGE_KEY = "flexsell-coupons-storage";

function getLocalCoupons(): Coupon[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COUPONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [
      {
        _id: "cp-welcome10",
        code: "WELCOME10",
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 500,
        maxDiscount: 200,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        usedCount: 0
      }
    ];
  } catch (err) {
    console.error("Failed to read coupons from localStorage", err);
    return [];
  }
}

function saveLocalCoupons(coupons: Coupon[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
  } catch (err) {
    console.error("Failed to save coupons to localStorage", err);
  }
}

export const couponService = {
  async getCoupons(): Promise<Coupon[]> {
    if (isMockMode) {
      return getLocalCoupons();
    }
    return apiClient.get<Coupon[]>("/coupons");
  },

  async createCoupon(data: Omit<Coupon, "_id" | "createdAt">): Promise<Coupon> {
    if (isMockMode) {
      const coupons = getLocalCoupons();
      const newCoupon: Coupon = {
        ...data,
        _id: "cp-" + Date.now(),
        code: data.code.toUpperCase(),
        usedCount: 0,
        createdAt: new Date().toISOString()
      };
      saveLocalCoupons([...coupons, newCoupon]);
      return newCoupon;
    }
    return apiClient.post<Coupon>("/coupons", data);
  },

  async updateCoupon(id: string, data: Partial<Coupon>): Promise<Coupon> {
    if (isMockMode) {
      const coupons = getLocalCoupons();
      let updatedCoupon: Coupon | null = null;
      const updatedList = coupons.map(c => {
        if (c._id === id) {
          updatedCoupon = { ...c, ...data };
          return updatedCoupon;
        }
        return c;
      });
      saveLocalCoupons(updatedList);
      if (!updatedCoupon) throw new Error("Coupon not found");
      return updatedCoupon;
    }
    return apiClient.put<Coupon>(`/coupons/${id}`, data);
  },

  async deleteCoupon(id: string): Promise<void> {
    if (isMockMode) {
      const coupons = getLocalCoupons();
      saveLocalCoupons(coupons.filter(c => c._id !== id));
      return;
    }
    return apiClient.delete<void>(`/coupons/${id}`);
  },

  async validateCoupon(code: string, orderAmount: number): Promise<{ valid: boolean; discountAmount: number; coupon?: Coupon; message?: string }> {
    if (isMockMode) {
      const coupons = getLocalCoupons();
      const targetCode = code.trim().toUpperCase();
      const coupon = coupons.find(c => c.code.toUpperCase() === targetCode && c.isActive);

      if (!coupon) {
        return { valid: false, discountAmount: 0, message: "Invalid or inactive promotional coupon code." };
      }

      if (coupon.minOrderValue && orderAmount < coupon.minOrderValue) {
        return { valid: false, discountAmount: 0, message: `Minimum order amount for this coupon is ₹${coupon.minOrderValue}.` };
      }

      let discount = 0;
      if (coupon.discountType === "percentage") {
        discount = (orderAmount * coupon.discountValue) / 100;
        if (coupon.maxDiscount && discount > coupon.maxDiscount) {
          discount = coupon.maxDiscount;
        }
      } else {
        discount = coupon.discountValue;
      }

      return { valid: true, discountAmount: Math.round(discount), coupon };
    }

    return apiClient.post<{ valid: boolean; discountAmount: number; coupon?: Coupon; message?: string }>("/coupons/validate", { code, orderAmount });
  }
};
