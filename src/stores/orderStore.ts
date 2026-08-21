import { create } from "zustand";
import { Order, ShipmentDetails, CartItem } from "@/types";
import { orderService, OrderListParams } from "@/services/orderService";
import { handleApiError } from "@/lib/apiClient";

export type { Order, ShipmentDetails, OrderListParams };

interface OrderStoreState {
  orders: Order[];
  /**
   * Server-side paging, populated only when the caller asks for a page.
   *
   * `initializeOrders()` with no page/limit keeps its old behaviour — the newest 100 —
   * because nine call sites depend on it for aggregates rather than for a list. Only the
   * order manager sends page/limit, and only it reads these.
   */
  total: number;
  page: number;
  totalPages: number;
  analytics?: {
    totalAmount: number;
    pendingCount: number;
    toDispatchCount: number;
  };
  isLoading: boolean;
  error: string | null;
  initializeOrders: (params?: OrderListParams) => Promise<void>;
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
    couponDiscount?: number,
    charges?: { shippingCharge?: number; packagingCharge?: number }
  ) => Promise<string>;
  updateOrderStatus: (id: string, status: Order["status"], paymentDetails?: any) => Promise<void>;
  shipOrder: (id: string, shipmentDetails: ShipmentDetails) => Promise<void>;
  cancelOrder: (id: string) => Promise<void>;
}

export const useOrderStore = create<OrderStoreState>()((set) => ({
  orders: [],
  total: 0,
  page: 1,
  totalPages: 1,
  isLoading: false,
  error: null,

  initializeOrders: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const data = await orderService.getOrders(params) as any;
      const ordersList = Array.isArray(data) ? data : data.orders || [];
      // An array response is the unpaginated branch; the object carries the paging.
      set({
        orders: ordersList,
        total: Array.isArray(data) ? ordersList.length : data.total ?? ordersList.length,
        page: Array.isArray(data) ? 1 : data.page ?? 1,
        totalPages: Array.isArray(data) ? 1 : data.totalPages ?? 1,
        analytics: Array.isArray(data) ? undefined : data.analytics,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to load orders"),
        isLoading: false
      });
    }
  },

  createOrder: async (items, amount, shippingAddress, paymentDetails, couponCode, couponDiscount, charges) => {
    set({ isLoading: true, error: null });
    try {
      const newOrder = await orderService.createOrder(items, amount, shippingAddress, paymentDetails, couponCode, couponDiscount, undefined, charges);
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
  },

  cancelOrder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const updatedOrder = await orderService.cancelOrder(id);
      set((state) => ({
        orders: state.orders.map((o) => (o._id === id ? updatedOrder : o)),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to cancel order"),
        isLoading: false
      });
      throw err;
    }
  }
}));
