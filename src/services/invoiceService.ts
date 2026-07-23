import { Invoice, Order } from "@/types";
import { apiClient, isMockMode } from "@/lib/apiClient";
import { generateNextClientMockId } from "@/lib/idGenerator";
import { dispatchEvent } from "@/lib/events/eventDispatcher";

export interface InvoiceListParams {
  type?: "invoice" | "receipt" | "quote";
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  customerType?: string;
}

const INVOICES_STORAGE_KEY = "flexsell-invoices-storage";

function getLocalInvoices(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    let list: Invoice[] = raw ? JSON.parse(raw) : [];

    // Pre-populate mock data if empty
    if (list.length === 0) {
      list = [
        {
          _id: "QUO-2026-00001",
          type: "quote",
          customerName: "Fakhri Enterprises",
          customerEmail: "fakhri@wholesale.com",
          customerGstin: "23AAACF1001M1Z5",
          items: [
            {
              id: "PROD-1-color-size",
              productId: "PROD-1",
              product: {
                _id: "PROD-1",
                title: "Premium Cotton T-Shirt",
                slug: "premium-cotton-tshirt",
                description: "High quality premium cotton wholesale tshirt.",
                categoryId: "CAT-1",
                rating: 4.8,
                reviewCount: 12,
                tags: ["tshirt", "cotton"],
                isActive: true,
                totalStock: 500,
                colorVariants: [
                  {
                    color: "Black",
                    dimensions: "L",
                    images: ["/placeholder.png"],
                    subVariants: [
                      {
                        id: "sub-1",
                        size: "L",
                        weight: "200g",
                        mrp: 699,
                        b2cPrice: 599,
                        b2bPrice: 350,
                        dropshippingPrice: 450,
                        stock: 250,
                        sku: "TSH-BLK-L",
                        discount: 0,
                        isActive: true
                      }
                    ]
                  }
                ],
                gstRate: 18,
                hsnCode: "6109",
                priceIncludesGst: true
              },
              selectedVariants: { Color: "Black", Size: "L" },
              quantity: 100,
              pricePerUnit: 350
            }
          ],
          amount: 35150, // 35000 + 150 shipping
          taxDetails: {
            isIntrastate: true,
            baseSubtotal: 29661.02,
            cgst: 2669.49,
            sgst: 2669.49,
            igst: 0,
            hsnSlabs: [
              {
                hsnCode: "6109",
                gstRate: 18,
                baseAmount: 29661.02,
                totalTax: 5338.98,
                cgst: 2669.49,
                sgst: 2669.49,
                igst: 0
              }
            ]
          },
          shippingAddress: {
            firstName: "Fakhri",
            lastName: "Enterprises",
            email: "fakhri@wholesale.com",
            company: "Fakhri Wholesale Tech",
            address: "101, Business Park",
            city: "Indore",
            state: "Madhya Pradesh",
            pinCode: "452001",
            phone: "9826012345",
            gstin: "23AAACF1001M1Z5"
          },
          sellerInfo: {
            storeName: "FlexSell Wholesale",
            gstin: "24AAACF1001M1Z5",
            address: "Plot No. 12, GIDC, Surat, Gujarat - 394230",
            email: "support@flexsell.in",
            phone: "+91 261 2409000"
          },
          generatedAt: "20-Jul-2026",
          generatedBy: "admin-1",
          status: "sent",
          salesperson: "Vikram Singh"
        },
        {
          _id: "RCP-2026-00002",
          type: "receipt",
          orderId: "FS-2026-00102",
          customerName: "Jane Doe Retailer",
          customerEmail: "jane@retail.com",
          items: [],
          amount: 15150,
          taxDetails: {
            isIntrastate: false,
            baseSubtotal: 12711.86,
            cgst: 0,
            sgst: 0,
            igst: 2288.14,
            hsnSlabs: []
          },
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
          sellerInfo: {
            storeName: "FlexSell Wholesale",
            gstin: "24AAACF1001M1Z5",
            address: "Plot No. 12, GIDC, Surat, Gujarat - 394230",
            email: "support@flexsell.in",
            phone: "+91 261 2409000"
          },
          generatedAt: "19-Jul-2026",
          generatedBy: "system",
          status: "pending",
          paymentStatus: "Pending",
          paymentMethod: "Bank Transfer"
        },
        {
          _id: "INV-2026-00003",
          type: "invoice",
          orderId: "FS-2026-00103",
          customerName: "Jane Doe Retailer",
          customerEmail: "jane@retail.com",
          items: [],
          amount: 25150,
          taxDetails: {
            isIntrastate: false,
            baseSubtotal: 21186.44,
            cgst: 0,
            sgst: 0,
            igst: 3813.56,
            hsnSlabs: []
          },
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
          sellerInfo: {
            storeName: "FlexSell Wholesale",
            gstin: "24AAACF1001M1Z5",
            address: "Plot No. 12, GIDC, Surat, Gujarat - 394230",
            email: "support@flexsell.in",
            phone: "+91 261 2409000"
          },
          generatedAt: "18-Jul-2026",
          generatedBy: "system",
          status: "paid",
          paymentStatus: "Paid",
          paymentMethod: "UPI",
          transactionId: "TXN10293847"
        }
      ];
      localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch (err) {
    console.error("Local invoices read failed:", err);
    return [];
  }
}

function saveLocalInvoices(list: Invoice[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(list));
}

export const invoiceService = {
  async getInvoices(params?: InvoiceListParams): Promise<unknown> {
    if (isMockMode) {
      let list = getLocalInvoices();

      // Filter active (non-archived) by default unless requested
      if (!params?.status || params.status !== "archived") {
        list = list.filter(i => i.status !== "archived");
      }

      if (params?.type) list = list.filter(i => i.type === params.type);
      if (params?.status) list = list.filter(i => i.status === params.status);
      if (params?.customerId) list = list.filter(i => i.customerId === params.customerId);
      if (params?.customerType) list = list.filter(i => i.customerType === params.customerType);
      
      if (params?.search) {
        const q = params.search.toLowerCase();
        list = list.filter(i =>
          i._id.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.customerEmail.toLowerCase().includes(q) ||
          (i.orderId && i.orderId.toLowerCase().includes(q)) ||
          (i.salesperson && i.salesperson.toLowerCase().includes(q))
        );
      }

      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const total = list.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const paginated = list.slice(start, start + limit);

      return {
        invoices: paginated,
        total,
        page,
        totalPages
      };
    }

    let url = "/invoices";
    const queryParams: string[] = [];
    if (params?.type) queryParams.push(`type=${params.type}`);
    if (params?.status) queryParams.push(`status=${params.status}`);
    if (params?.customerId) queryParams.push(`customerId=${params.customerId}`);
    if (params?.startDate) queryParams.push(`startDate=${params.startDate}`);
    if (params?.endDate) queryParams.push(`endDate=${params.endDate}`);
    if (params?.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.page) queryParams.push(`page=${params.page}`);
    if (params?.limit) queryParams.push(`limit=${params.limit}`);
    if (params?.customerType) queryParams.push(`customerType=${params.customerType}`);
    
    if (queryParams.length > 0) {
      url += `?${queryParams.join("&")}`;
    }
    return apiClient.get<unknown>(url);
  },

  async getInvoiceById(id: string): Promise<Invoice> {
    if (isMockMode) {
      const match = getLocalInvoices().find(i => i._id === id);
      if (!match) throw new Error("Document not found");
      return match;
    }
    return apiClient.get<Invoice>(`/invoices/${id}`);
  },

  async createInvoice(data: Partial<Invoice> & {
    newCustomer?: {
      name: string;
      email: string;
      phone: string;
      address: string;
      city: string;
      state: string;
      pinCode: string;
      company?: string;
      gstin?: string;
    };
  }): Promise<Invoice> {
    if (isMockMode) {
      const list = getLocalInvoices();
      const id = generateNextClientMockId(data.type || "quote");
      
      let customerId = data.customerId;
      if (data.newCustomer) {
        customerId = generateNextClientMockId("customer");
        const customersRaw = localStorage.getItem("flexsell-customers-storage");
        const customersList = customersRaw ? JSON.parse(customersRaw) : [];
        customersList.push({
          _id: customerId,
          name: data.newCustomer.name,
          email: data.newCustomer.email,
          phone: data.newCustomer.phone,
          address: data.newCustomer.address,
          city: data.newCustomer.city,
          state: data.newCustomer.state,
          pinCode: data.newCustomer.pinCode,
          company: data.newCustomer.company,
          gstin: data.newCustomer.gstin,
          customerTypes: [data.type === "quote" ? "B2B" : "B2C"],
          initials: data.newCustomer.name.slice(0, 2).toUpperCase()
        });
        localStorage.setItem("flexsell-customers-storage", JSON.stringify(customersList));
      }

      // Default status
      let defaultStatus = "draft";
      if (data.type === "invoice") defaultStatus = "paid";
      else if (data.type === "receipt") defaultStatus = "pending";

      const newDoc: Invoice = {
        _id: id,
        type: data.type || "quote",
        orderId: data.orderId,
        customerId,
        customerName: data.customerName || data.newCustomer?.name || "Anonymous",
        customerEmail: data.customerEmail || data.newCustomer?.email || "",
        customerGstin: data.customerGstin || data.newCustomer?.gstin,
        items: data.items || [],
        amount: data.amount || 0,
        taxDetails: data.taxDetails || {
          isIntrastate: true,
          baseSubtotal: (data.amount || 0) / 1.18,
          cgst: ((data.amount || 0) - (data.amount || 0) / 1.18) / 2,
          sgst: ((data.amount || 0) - (data.amount || 0) / 1.18) / 2,
          igst: 0,
          hsnSlabs: []
        },
        shippingAddress: data.shippingAddress || {
          firstName: (data.customerName || data.newCustomer?.name || "Client").split(" ")[0],
          lastName: (data.customerName || data.newCustomer?.name || "Client").split(" ")[1] || "",
          email: data.customerEmail || data.newCustomer?.email || "",
          address: data.newCustomer?.address || "",
          city: data.newCustomer?.city || "",
          state: data.newCustomer?.state || "Madhya Pradesh",
          pinCode: data.newCustomer?.pinCode || "",
          phone: data.newCustomer?.phone || ""
        },
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentStatus || (data.type === "invoice" ? "Paid" : "Pending"),
        transactionId: data.transactionId,
        sellerInfo: data.sellerInfo || {
          storeName: "FlexSell Wholesale",
          gstin: "24AAACF1001M1Z5",
          address: "Plot No. 12, GIDC, Surat, Gujarat - 394230",
          email: "support@flexsell.in",
          phone: "+91 261 2409000"
        },
        notes: data.notes,
        generatedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        generatedBy: "admin",
        status: (data.status || defaultStatus) as Invoice["status"],
        salesperson: data.salesperson
      };

      list.unshift(newDoc);
      saveLocalInvoices(list);

      const evtType = newDoc.type === "invoice" ? "INVOICE_GENERATED" : newDoc.type === "receipt" ? "RECEIPT_GENERATED" : "QUOTE_GENERATED";
      const catName = newDoc.type === "invoice" ? "invoices" : newDoc.type === "receipt" ? "payments" : "quotes";

      dispatchEvent({
        eventType: evtType,
        category: catName as any,
        actor: { id: "admin", name: "Admin", role: "admin" },
        recipient: { customerId: customerId || "current-user", email: newDoc.customerEmail, name: newDoc.customerName, role: "both" },
        entity: { type: newDoc.type, id: newDoc._id },
        data: newDoc,
      });

      return newDoc;
    }
    return apiClient.post<Invoice>("/invoices", data);
  },

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
    if (isMockMode) {
      const list = getLocalInvoices();
      const matchIndex = list.findIndex(i => i._id === id);
      if (matchIndex === -1) throw new Error("Document not found");

      const match = list[matchIndex];
      // Locked state checking
      if (match.type === "invoice" && data.status !== "archived") {
        throw new Error("Invoice details and status cannot be modified once generated.");
      }
      if (match.type === "quote" && match.status === "converted") {
        throw new Error("Converted quotes cannot be modified.");
      }

      // Convert Receipt to Invoice
      let updatedType = match.type;
      let updatedStatus = data.status || match.status;
      let updatedPaymentStatus = data.paymentStatus || match.paymentStatus;

      if (match.type === "receipt" && (data.status === "paid" || data.paymentStatus === "Paid")) {
        // Safe check for duplicate order invoice
        if (match.orderId) {
          const duplicate = list.find(x => x.orderId === match.orderId && x.type === "invoice");
          if (duplicate) throw new Error("An invoice has already been generated for this order.");
        }
        updatedType = "invoice";
        updatedStatus = "paid";
        updatedPaymentStatus = "Paid";

        // Sync order payment status in mock mode
        if (match.orderId) {
          const ordersRaw = localStorage.getItem("flexsell-orders-storage");
          if (ordersRaw) {
            const orders = JSON.parse(ordersRaw) as Order[];
            const ordIdx = orders.findIndex((o) => o._id === match.orderId);
            if (ordIdx !== -1) {
              orders[ordIdx].paymentStatus = "Paid";
              orders[ordIdx].paymentMethod = (data.paymentMethod || match.paymentMethod) as Order["paymentMethod"];
              orders[ordIdx].transactionId = data.transactionId || match.transactionId;
              localStorage.setItem("flexsell-orders-storage", JSON.stringify(orders));
            }
          }
        }
      }

      const updatedDoc: Invoice = {
        ...match,
        ...data,
        type: updatedType,
        status: updatedStatus as Invoice["status"],
        paymentStatus: updatedPaymentStatus
      };

      list[matchIndex] = updatedDoc;
      saveLocalInvoices(list);
      return updatedDoc;
    }
    return apiClient.put<Invoice>(`/invoices/${id}`, data);
  },

  async voidInvoice(id: string): Promise<Invoice> {
    return this.updateInvoice(id, { status: "void" });
  },

  async deleteInvoice(id: string): Promise<void> {
    if (isMockMode) {
      const list = getLocalInvoices();
      const match = list.find(i => i._id === id);
      if (!match) throw new Error("Document not found");

      if (match.type === "invoice") {
        throw new Error("Invoices cannot be permanently deleted. You can archive them instead.");
      }
      if (match.type === "quote" && match.status === "converted") {
        throw new Error("Converted quotes cannot be deleted.");
      }

      // Write deletion audit trail to history/console in mock
      console.log(`[AUDIT] Deleted ${match.type} ${id} by Admin.`);

      const filtered = list.filter(i => i._id !== id);
      saveLocalInvoices(filtered);
      return;
    }
    return apiClient.delete(`/invoices/${id}`);
  },

  async getInvoiceByOrderId(orderId: string): Promise<Invoice | null> {
    if (isMockMode) {
      const match = getLocalInvoices().find(i => i.orderId === orderId);
      return match || null;
    }
    try {
      const result = await apiClient.get<unknown>(`/invoices?orderId=${orderId}`);
      const invoices = Array.isArray(result) ? result : (result as { invoices?: Invoice[] }).invoices || [];
      return invoices.length > 0 ? invoices[0] : null;
    } catch {
      return null;
    }
  }
};
