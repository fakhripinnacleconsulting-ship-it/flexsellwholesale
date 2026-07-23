import { Order, ShipmentDetails, CartItem, Invoice } from "@/types";
import { apiClient, isMockMode } from "@/lib/apiClient";
import { generateNextClientMockId } from "@/lib/idGenerator";
import { dispatchEvent } from "@/lib/events/eventDispatcher";

const ORDERS_STORAGE_KEY = "flexsell-orders-storage";
const INVOICES_STORAGE_KEY = "flexsell-invoices-storage";

function getLocalOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    let list: Order[] = raw ? JSON.parse(raw) : [];

    // Pre-populate mock orders if empty
    if (list.length === 0) {
      list = [
        {
          _id: "FS-2026-00102",
          date: "19-Jul-2026",
          amount: 15150,
          status: "Processing",
          statusClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
          itemsCount: 2,
          customerName: "Jane Doe Retailer",
          shippingAddress: {
            firstName: "Jane",
            lastName: "Doeer",
            email: "jane@retail.com",
            address: "Sector 5, Market Area",
            city: "Surat",
            state: "Gujarat",
            pinCode: "395003",
            phone: "9876543210"
          },
          items: [],
          paymentMethod: "Bank Transfer",
          paymentStatus: "Pending",
          history: [
            {
              status: "Placed",
              timestamp: "19-Jul-2026 02:30 PM",
              description: "Wholesale order generated successfully. Payment pending verification."
            }
          ],
          invoiceId: "RCP-2026-00002"
        },
        {
          _id: "FS-2026-00103",
          date: "18-Jul-2026",
          amount: 25150,
          status: "Processing",
          statusClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
          itemsCount: 5,
          customerName: "Jane Doe Retailer",
          shippingAddress: {
            firstName: "Jane",
            lastName: "Doeer",
            email: "jane@retail.com",
            address: "Sector 5, Market Area",
            city: "Surat",
            state: "Gujarat",
            pinCode: "395003",
            phone: "9876543210"
          },
          items: [],
          paymentMethod: "UPI",
          paymentStatus: "Paid",
          transactionId: "TXN10293847",
          history: [
            {
              status: "Placed",
              timestamp: "18-Jul-2026 11:15 AM",
              description: "Wholesale order generated successfully. Online Payment verified (Txn ID: TXN10293847)."
            }
          ],
          invoiceId: "INV-2026-00003"
        }
      ];
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch (err) {
    console.error("Local orders read failed:", err);
    return [];
  }
}

function saveLocalOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export const orderService = {
  async getOrders(params?: { 
    page?: number; 
    limit?: number; 
    startDate?: string; 
    endDate?: string;
    orderType?: string;
    origin?: string;
  }): Promise<unknown> {
    if (isMockMode) {
      let list = getLocalOrders();
      if (params?.startDate) {
        list = list.filter(o => new Date(o.date) >= new Date(params.startDate!));
      }
      if (params?.endDate) {
        list = list.filter(o => new Date(o.date) <= new Date(params.endDate!));
      }
      if (params?.orderType) {
        list = list.filter(o => o.orderType === params.orderType);
      }
      if (params?.origin) {
        list = list.filter(o => o.origin === params.origin);
      }

      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const total = list.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paginated = list.slice(start, start + limit);

      return {
        orders: paginated,
        total,
        page,
        totalPages
      };
    }

    let url = "/orders";
    const queryParams: string[] = [];
    if (params?.page) queryParams.push(`page=${params.page}`);
    if (params?.limit) queryParams.push(`limit=${params.limit}`);
    if (params?.startDate) queryParams.push(`startDate=${params.startDate}`);
    if (params?.endDate) queryParams.push(`endDate=${params.endDate}`);
    if (params?.orderType) queryParams.push(`orderType=${params.orderType}`);
    if (params?.origin) queryParams.push(`origin=${params.origin}`);
    
    if (queryParams.length > 0) {
      url += `?${queryParams.join("&")}`;
    }
    return apiClient.get<unknown>(url);
  },

  async createOrder(
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
    quoteId?: string,
    salesperson?: string
  ): Promise<Order> {
    if (isMockMode) {
      const orders = getLocalOrders();
      
      // Idempotency check for quoteId
      if (quoteId) {
        const existing = orders.find(o => o.quoteId === quoteId);
        if (existing) {
          return existing;
        }
      }

      const id = generateNextClientMockId("order");
      const docType = paymentDetails?.paymentStatus === "Paid" ? "invoice" : "receipt";
      const invoiceId = generateNextClientMockId(docType);

      // Generate invoice/receipt in local storage
      const invoicesRaw = localStorage.getItem(INVOICES_STORAGE_KEY);
      const invoices = invoicesRaw ? JSON.parse(invoicesRaw) : [];
      
      const newDoc: Invoice = {
        _id: invoiceId,
        type: docType,
        orderId: id,
        customerId: "MOCK-CUST-1",
        customerName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        customerEmail: shippingAddress.email.toLowerCase(),
        customerGstin: shippingAddress.gstin || undefined,
        items,
        amount,
        taxDetails: {
          isIntrastate: true,
          baseSubtotal: amount / 1.18,
          cgst: (amount - amount / 1.18) / 2,
          sgst: (amount - amount / 1.18) / 2,
          igst: 0,
          hsnSlabs: []
        },
        shippingAddress,
        paymentMethod: paymentDetails?.paymentMethod,
        paymentStatus: paymentDetails?.paymentStatus || "Pending",
        transactionId: paymentDetails?.transactionId,
        sellerInfo: {
          storeName: "FlexSell Wholesale",
          gstin: "24AAACF1001M1Z5",
          address: "Plot No. 12, GIDC, Surat, Gujarat - 394230",
          email: "support@flexsell.in",
          phone: "+91 261 2409000"
        },
        generatedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        generatedBy: "admin",
        status: docType === "invoice" ? "paid" : "pending",
        salesperson
      };

      invoices.unshift(newDoc);
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));

      // Mark Quote converted in local storage
      if (quoteId) {
        const matchIdx = invoices.findIndex((q: Invoice) => q._id === quoteId);
        if (matchIdx !== -1) {
          invoices[matchIdx].status = "converted";
          invoices[matchIdx].orderId = id;
          localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
        }
      }

      const newOrder: Order = {
        _id: id,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        amount,
        status: "Processing",
        statusClass: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
        itemsCount: items.reduce((sum, item) => sum + item.quantity, 0),
        customerName: `${shippingAddress.firstName} ${shippingAddress.lastName}${shippingAddress.company ? ` (${shippingAddress.company})` : ""}`,
        shippingAddress,
        items,
        paymentMethod: paymentDetails?.paymentMethod,
        paymentStatus: paymentDetails?.paymentStatus || "Pending",
        transactionId: paymentDetails?.transactionId,
        invoiceId,
        quoteId,
        salesperson,
        couponCode,
        couponDiscount,
        history: [
          {
            status: "Placed",
            timestamp: new Date().toLocaleString("en-US"),
            description: paymentDetails?.paymentStatus === "Paid"
              ? `Wholesale order generated successfully. Online Payment verified (Txn ID: ${paymentDetails.transactionId}).`
              : "Wholesale order generated successfully. Payment pending verification."
          }
        ]
      };

      orders.unshift(newOrder);
      saveLocalOrders(orders);

      dispatchEvent({
        eventType: "ORDER_CREATED",
        category: "orders",
        actor: { id: "current-user", name: newOrder.customerName, role: "customer" },
        recipient: { customerId: "current-user", email: shippingAddress.email, name: newOrder.customerName, role: "both" },
        entity: { type: "order", id },
        data: newOrder,
      });

      return newOrder;
    }

    return apiClient.post<Order>("/orders", { 
      items, 
      amount, 
      shippingAddress, 
      paymentDetails,
      couponCode,
      couponDiscount,
      quoteId,
      salesperson
    });
  },

  async updateOrderStatus(
    id: string, 
    status: Order["status"],
    paymentDetails?: { paymentStatus: string; paymentMethod: string; transactionId?: string }
  ): Promise<Order> {
    if (isMockMode) {
      const orders = getLocalOrders();
      const matchIndex = orders.findIndex(o => o._id === id);
      if (matchIndex === -1) throw new Error("Order not found");

      const match = orders[matchIndex];
      const updatedOrder: Order = {
        ...match,
        status,
        statusClass: status === "Delivered" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400" :
                     status === "Shipped" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400" :
                     status === "Cancelled" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" :
                     "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
        paymentStatus: paymentDetails?.paymentStatus ? (paymentDetails.paymentStatus as any) : match.paymentStatus,
        paymentMethod: paymentDetails?.paymentMethod ? (paymentDetails.paymentMethod as any) : match.paymentMethod,
        transactionId: paymentDetails?.transactionId ? paymentDetails.transactionId : match.transactionId,
        history: [
          {
            status,
            timestamp: new Date().toLocaleString("en-US"),
            description: `Order status updated to ${status}.`
          },
          ...match.history
        ]
      };

      orders[matchIndex] = updatedOrder;
      saveLocalOrders(orders);

      dispatchEvent({
        eventType: status === "Shipped" ? "ORDER_SHIPPED" : "ORDER_STATUS_CHANGED",
        category: status === "Shipped" ? "shipments" : "orders",
        actor: { id: "admin", name: "Admin", role: "admin" },
        recipient: { customerId: "current-user", email: match.shippingAddress?.email, name: match.customerName, role: "customer" },
        entity: { type: "order", id },
        data: updatedOrder,
      });

      return updatedOrder;
    }
    return apiClient.put<Order>(`/orders/${id}/status`, { 
      status,
      paymentStatus: paymentDetails?.paymentStatus,
      paymentMethod: paymentDetails?.paymentMethod,
      transactionId: paymentDetails?.transactionId,
    });
  },

  async shipOrder(id: string, shipmentDetails: ShipmentDetails): Promise<Order> {
    if (isMockMode) {
      const orders = getLocalOrders();
      const matchIndex = orders.findIndex(o => o._id === id);
      if (matchIndex === -1) throw new Error("Order not found");

      const match = orders[matchIndex];
      const updatedOrder: Order = {
        ...match,
        status: "Shipped",
        statusClass: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
        shipmentDetails,
        history: [
          {
            status: "Shipped",
            timestamp: new Date().toLocaleString("en-US"),
            description: `Cargo dispatched via ${shipmentDetails.type === "self" ? "Self Shipment" : shipmentDetails.carrierName} with Tracking ID: ${shipmentDetails.trackingId}`
          },
          ...match.history
        ]
      };

      orders[matchIndex] = updatedOrder;
      saveLocalOrders(orders);

      dispatchEvent({
        eventType: "ORDER_SHIPPED",
        category: "shipments",
        actor: { id: "admin", name: "Admin", role: "admin" },
        recipient: { customerId: "current-user", email: match.shippingAddress?.email, name: match.customerName, role: "customer" },
        entity: { type: "order", id },
        data: {
          order: updatedOrder,
          carrierName: shipmentDetails.carrierName || "Courier",
          trackingId: shipmentDetails.trackingId,
          trackingUrl: shipmentDetails.trackingUrl,
        },
      });

      return updatedOrder;
    }
    return apiClient.put<Order>(`/orders/${id}/ship`, shipmentDetails);
  },

  async getOrderById(id: string): Promise<Order> {
    if (isMockMode) {
      const match = getLocalOrders().find(o => o._id === id);
      if (!match) throw new Error("Order not found");
      return match;
    }
    return apiClient.get<Order>(`/orders/${id}`);
  }
};
