import { describe, it, expect, vi, beforeEach } from "vitest";
import { productService } from "@/services/productService";

// Mock dbConnect
vi.mock("@/lib/dbConnect", () => {
  return {
    default: vi.fn().mockResolvedValue({}),
  };
});

// Mock Mongoose Models
const mockCategories = [
  { _id: "cat-a", name: "Category A", isActive: true },
  { _id: "cat-b", name: "Category B", isActive: true },
  { _id: "cat-inactive", name: "Category Inactive", isActive: false },
];

const mockProducts = [
  { _id: "prod-a1", title: "Product A1", categoryId: "cat-a", isActive: true, createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "prod-a2", title: "Product A2", categoryId: "cat-a", isActive: true, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "prod-b1", title: "Product B1", categoryId: "cat-b", isActive: true, createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: "prod-inactive", title: "Product Inactive", categoryId: "cat-a", isActive: false, createdAt: new Date().toISOString() },
];

const mockOrders = [
  {
    status: "Processing",
    items: [
      { productId: "prod-a1", quantity: 5 },
      { product: { _id: "prod-a2" }, quantity: 12 }, // Tests both nested product and productId structure
    ]
  },
  {
    status: "Cancelled", // Should be ignored in sales calculations
    items: [
      { productId: "prod-a1", quantity: 100 }
    ]
  },
  {
    status: "Shipped",
    items: [
      { productId: "prod-a1", quantity: 3 }
    ]
  }
];

// Mock Mongoose model methods
vi.mock("@/models/Product", () => {
  return {
    default: {
      find: vi.fn().mockImplementation((query) => {
        let list = [...mockProducts];
        if (query.isActive !== undefined) {
          list = list.filter(p => p.isActive === query.isActive);
        }
        if (query.createdAt && query.createdAt.$gte) {
          const cutDate = new Date(query.createdAt.$gte).getTime();
          list = list.filter(p => new Date(p.createdAt).getTime() >= cutDate);
        }
        return {
          sort: vi.fn().mockImplementation((sortObj) => {
            if (sortObj.createdAt === -1) {
              list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
            return {
              lean: vi.fn().mockResolvedValue(list),
            };
          }),
          lean: vi.fn().mockResolvedValue(list),
        };
      }),
    },
  };
});

vi.mock("@/models/Category", () => {
  return {
    default: {
      find: vi.fn().mockImplementation((query) => {
        let list = [...mockCategories];
        if (query.isActive !== undefined) {
          list = list.filter(c => c.isActive === query.isActive);
        }
        return {
          select: vi.fn().mockImplementation(() => {
            return {
              lean: vi.fn().mockResolvedValue(list),
            };
          }),
          lean: vi.fn().mockResolvedValue(list),
        };
      }),
    },
  };
});

vi.mock("@/models/Order", () => {
  return {
    default: {
      find: vi.fn().mockImplementation((query) => {
        let list = [...mockOrders];
        if (query.status && query.status.$ne) {
          list = list.filter(o => o.status !== query.status.$ne);
        }
        return {
          select: vi.fn().mockImplementation(() => {
            return {
              lean: vi.fn().mockResolvedValue(list),
            };
          }),
          lean: vi.fn().mockResolvedValue(list),
        };
      }),
    },
  };
});

describe("Trending Products and New Arrivals Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTrendingProducts", () => {
    it("should calculate trending products by purchases count and guarantee at least one product per active category", async () => {
      const trending = await productService.getTrendingProducts();

      // Category A active products: prod-a1, prod-a2
      // Category B active products: prod-b1
      // Sales totals:
      // prod-a2 has 12 sales (from active order items)
      // prod-a1 has 5 + 3 = 8 sales (from active order items, cancelled order is ignored)
      // prod-b1 has 0 sales
      
      // Since it guarantees at least 1 product per active category:
      // Category A top product is prod-a2 (12 sales)
      // Category B top product is prod-b1 (0 sales)
      // Other products with sales > 0 are added: prod-a1 (8 sales)
      // Total list gathered: prod-a2, prod-b1, prod-a1
      // The final list is sorted by sales count descending, then createdAt descending:
      // 1. prod-a2 (12 sales)
      // 2. prod-a1 (8 sales)
      // 3. prod-b1 (0 sales)

      expect(trending).toHaveLength(3);
      expect(trending[0]._id).toBe("prod-a2");
      expect(trending[1]._id).toBe("prod-a1");
      expect(trending[2]._id).toBe("prod-b1");
    });
  });

  describe("getNewArrivals", () => {
    it("should fetch active products created in the last 7 days sorted by newest first", async () => {
      const newArrivals = await productService.getNewArrivals();

      // mockProducts:
      // prod-a1: 10 days ago (old)
      // prod-a2: 5 days ago (new)
      // prod-b1: 2 days ago (new)
      // prod-inactive: today (but inactive)
      
      // Expected active, new products: prod-b1 (2 days ago), prod-a2 (5 days ago) sorted newest first.

      expect(newArrivals).toHaveLength(2);
      expect(newArrivals[0]._id).toBe("prod-b1");
      expect(newArrivals[1]._id).toBe("prod-a2");
    });
  });
});
