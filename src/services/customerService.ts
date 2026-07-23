import { Customer, SavedAddress } from "@/types";
import { apiClient, isMockMode } from "@/lib/apiClient";

const ADDRESSES_STORAGE_KEY = "flexsell-addresses-storage";

function getLocalAddresses(): SavedAddress[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADDRESSES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read addresses from localStorage", err);
    return [];
  }
}

function saveLocalAddresses(addresses: SavedAddress[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADDRESSES_STORAGE_KEY, JSON.stringify(addresses));
  } catch (err) {
    console.error("Failed to save addresses to localStorage", err);
  }
}

export const customerService = {
  async getCustomers(params?: { search?: string; page?: number; limit?: number; type?: string }): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (isMockMode) {
      if (typeof window === "undefined") return { customers: [], total: 0, page: 1, totalPages: 1 };
      try {
        const raw = localStorage.getItem("flexsell-customers-storage");
        let list: Customer[] = raw ? JSON.parse(raw) : [];
        if (list.length === 0) {
          list = [
            {
              _id: "FSW-CUST-00001",
              name: "Fakhri Enterprises",
              email: "fakhri@wholesale.com",
              company: "Fakhri Wholesale Tech",
              address: "101, Business Park",
              city: "Indore",
              state: "Madhya Pradesh",
              pinCode: "452001",
              phone: "9826012345",
              initials: "FE",
              gstin: "23AAACF1001M1Z5",
              customerTypes: ["B2B"],
            },
            {
              _id: "FSW-CUST-00002",
              name: "Jane Doe Retailer",
              email: "jane@retail.com",
              company: "Doe Fashion Store",
              address: "Sector 5, Market Area",
              city: "Surat",
              state: "Gujarat",
              pinCode: "395003",
              phone: "9876543210",
              initials: "JD",
              gstin: "24BBBCF2002P1Z6",
              customerTypes: ["B2B", "B2C"],
            },
            {
              _id: "FSW-CUST-00003",
              name: "Dropship Logistics",
              email: "dropship@fastship.com",
              company: "FastShip Dropshipping",
              address: "Warehouse Block C",
              city: "Mumbai",
              state: "Maharashtra",
              pinCode: "400001",
              phone: "9123456789",
              initials: "DL",
              customerTypes: ["Dropshipping"],
            }
          ];
          localStorage.setItem("flexsell-customers-storage", JSON.stringify(list));
        }

        if (params?.type) {
          list = list.filter(c => c.customerTypes?.includes(params.type as "B2B" | "B2C" | "Dropshipping"));
        }

        if (params?.search) {
          const q = params.search.toLowerCase();
          list = list.filter(c => 
            c._id.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            (c.company && c.company.toLowerCase().includes(q)) ||
            (c.gstin && c.gstin.toLowerCase().includes(q)) ||
            c.phone.includes(q)
          );
        }

        const page = params?.page || 1;
        const limit = params?.limit || 20;
        const total = list.length;
        const totalPages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const paginated = list.slice(start, start + limit);
        return { customers: paginated, total, page, totalPages };
      } catch (err) {
        console.error("Failed to load mock customers:", err);
        return { customers: [], total: 0, page: 1, totalPages: 1 };
      }
    }

    let url = "/customers";
    const queryParams: string[] = [];
    if (params?.search) queryParams.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.page) queryParams.push(`page=${params.page}`);
    if (params?.limit) queryParams.push(`limit=${params.limit}`);
    if (params?.type) queryParams.push(`type=${params.type}`);
    if (queryParams.length > 0) {
      url += `?${queryParams.join("&")}`;
    }
    return apiClient.get<unknown>(url);
  },

  async getActiveCustomer(): Promise<Customer> {
    return apiClient.get<Customer>("/customers/active");
  },

  async updateActiveCustomer(data: Partial<Customer>): Promise<Customer> {
    return apiClient.put<Customer>("/customers/active", data);
  },

  async getSavedAddresses(): Promise<SavedAddress[]> {
    if (isMockMode) {
      return getLocalAddresses();
    }
    return apiClient.get<SavedAddress[]>("/customers/addresses");
  },

  async addSavedAddress(data: Omit<SavedAddress, "_id">): Promise<SavedAddress[]> {
    if (isMockMode) {
      const addresses = getLocalAddresses();
      const newAddress: SavedAddress = {
        ...data,
        _id: "addr-" + Date.now(),
      };
      if (newAddress.isDefault) {
        addresses.forEach(a => { a.isDefault = false; });
      }
      const updated = [...addresses, newAddress];
      saveLocalAddresses(updated);
      return updated;
    }
    return apiClient.post<SavedAddress[]>("/customers/addresses", data);
  },

  async updateSavedAddress(data: SavedAddress): Promise<SavedAddress[]> {
    if (isMockMode) {
      const addresses = getLocalAddresses();
      const updated = addresses.map(a => {
        if (a._id === data._id) {
          return { ...a, ...data };
        }
        if (data.isDefault) {
          return { ...a, isDefault: false };
        }
        return a;
      });
      saveLocalAddresses(updated);
      return updated;
    }
    return apiClient.put<SavedAddress[]>("/customers/addresses", data);
  },

  async deleteSavedAddress(id: string): Promise<SavedAddress[]> {
    if (isMockMode) {
      const addresses = getLocalAddresses();
      const updated = addresses.filter(a => a._id !== id);
      saveLocalAddresses(updated);
      return updated;
    }
    return apiClient.delete<SavedAddress[]>(`/customers/addresses?id=${id}`);
  }
};
