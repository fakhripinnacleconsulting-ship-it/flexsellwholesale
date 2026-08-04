import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleSystemEvent } from "../eventHandlers";
import { emailService } from "../../emailService";

// Mocks
vi.mock("../../emailService", () => ({
  emailService: {
    sendAdminSecurityAlert: vi.fn(),
    sendAdminManagerActivityAlert: vi.fn(),
    sendOrderStatusUpdateEmail: vi.fn(),
  }
}));

const mockManagerFind = vi.fn();
vi.mock("@/models/Manager", () => ({
  default: {
    find: () => ({
      lean: mockManagerFind
    })
  }
}));

vi.mock("@/models/Notification", () => ({
  default: {
    create: vi.fn()
  }
}));

vi.mock("../../dbConnect", () => ({
  default: vi.fn().mockResolvedValue(true)
}));

vi.mock("../pushServiceServer", () => ({
  default: {
    sendPushNotification: vi.fn()
  }
}));

describe("System Event Handlers (RBAC Dispatcher)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManagerFind.mockResolvedValue([]);
  });

  it("should send admin security alert on SECURITY_ALERT event", async () => {
    const payload = {
      eventType: "SECURITY_ALERT" as any,
      category: "security" as const,
      actor: { role: "manager" as const, id: "MGR-1", name: "test@mgr.com" },
      recipient: { role: "admin" as const },
      entity: { type: "permission" as const, id: "orders_b2b" },
      data: { attemptedPermission: "orders_b2b" }
    };

    await handleSystemEvent(payload);

    expect(emailService.sendAdminSecurityAlert).toHaveBeenCalledWith(
      "test@mgr.com",
      "orders_b2b"
    );
  });

  it("should send manager activity alert when a manager triggers a system event", async () => {
    const payload = {
      eventType: "ORDER_STATUS_CHANGED" as any,
      category: "orders" as const,
      actor: { role: "manager" as const, id: "MGR-1", name: "John Doe" },
      recipient: { role: "admin" as const },
      entity: { type: "order" as const, id: "ORD-123" },
      data: { order: { _id: "ORD-123" }, status: "Shipped" }
    };

    await handleSystemEvent(payload);

    expect(emailService.sendAdminManagerActivityAlert).toHaveBeenCalledWith(
      "John Doe",
      expect.stringContaining("status updated to: Shipped")
    );
  });
});
