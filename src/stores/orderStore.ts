import { create } from "zustand";
import { Order, ShipmentDetails, CartItem } from "@/types";
import { orderService } from "@/services/orderService";
import { handleApiError } from "@/lib/apiClient";

export type { Order, ShipmentDetails };

interface OrderStoreState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  initializeOrders: (params?: { 
    page?: number; 
    limit?: number; 
    startDate?: string; 
    endDate?: string;
    orderType?: string;
    origin?: string;
  }) => Promise<void>;
  createOrder: (
    items: CartItem[], 
    amount: number, 
    shippingAddress: Order["shippingAddress"],
    paymentDetails?: {
      paymentMethod: Order["paymentMethod"];
      paymentStatus: Order["paymentStatus"];
      transactionId?: string;
    },
    couponCode?: string,
    couponDiscount?: number
  ) => Promise<string>;
  updateOrderStatus: (id: string, status: Order["status"], paymentDetails?: any) => Promise<void>;
  shipOrder: (id: string, shipmentDetails: ShipmentDetails) => Promise<void>;
}

export const useOrderStore = create<OrderStoreState>()((set) => ({
  orders: [],
  isLoading: false,
  error: null,

  initializeOrders: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const data = await orderService.getOrders(params) as any;
      const ordersList = Array.isArray(data) ? data : data.orders || [];
      set({ orders: ordersList, isLoading: false });
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to load orders"),
        isLoading: false
      });
    }
  },

  createOrder: async (items, amount, shippingAddress, paymentDetails, couponCode, couponDiscount) => {
    set({ isLoading: true, error: null });
    try {
      const newOrder = await orderService.createOrder(items, amount, shippingAddress, paymentDetails, couponCode, couponDiscount);
      set((state) => ({
        orders: [newOrder, ...state.orders],
        isLoading: false
      }));
      return newOrder._id;
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to create order"),
        isLoading: false
      });
      throw err;
    }
  },

  updateOrderStatus: async (id, status, paymentDetails) => {
    set({ isLoading: true, error: null });
    try {
      const updatedOrder = await orderService.updateOrderStatus(id, status, paymentDetails);
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? updatedOrder : o)),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to update order status"),
        isLoading: false
      });
      throw err;
    }
  },

  shipOrder: async (id, shipmentDetails) => {
    set({ isLoading: true, error: null });
    try {
      const updatedOrder = await orderService.shipOrder(id, shipmentDetails);
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? updatedOrder : o)),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to ship order"),
        isLoading: false
      });
      throw err;
    }
  }
}));
