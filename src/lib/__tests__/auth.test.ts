import { describe, it, expect, vi, beforeEach } from "vitest";
import { signToken, verifyToken, setTokenCookie, removeTokenCookie, getTokenFromCookie } from "../auth";
import { requireAuth, requireAdminOrManagerAuth, verifyManagerOrderAccess } from "../authGuard";
import { generateCsrfToken, validateCsrf } from "../csrf";
import { SESSION_HINT_COOKIE } from "../sessionHint";

// Mock next/headers
const mockSet = vi.fn();
const mockGet = vi.fn();
vi.mock("next/headers", () => {
  return {
    cookies: () => Promise.resolve({
      set: mockSet,
      get: mockGet,
    }),
  };
});

// Mock mongoose Manager model
const mockManagerFindById = vi.fn();
vi.mock("@/models/Manager", () => {
  return {
    default: {
      findById: () => ({
        lean: mockManagerFindById
      })
    }
  };
});

// Mock dbConnect
vi.mock("@/lib/dbConnect", () => ({
  default: vi.fn().mockResolvedValue(true)
}));

// Mock eventDispatcherServer
vi.mock("@/lib/events/eventDispatcherServer", () => ({
  dispatchEventServer: vi.fn()
}));

describe("Authentication Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("JWT Operations", () => {
    const payload = {
      userId: "FSW-1001",
      email: "test@example.com",
      role: "customer",
    };

    it("should successfully sign and verify a token", () => {
      const token = signToken(payload);
      expect(token).toBeTypeOf("string");

      const verified = verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
      expect(verified?.role).toBe(payload.role);
    });

    it("should return null for an invalid token", () => {
      const verified = verifyToken("invalid-token-string");
      expect(verified).toBeNull();
    });
  });

  describe("Cookie Management", () => {
    it("should set correct cookies on setTokenCookie", async () => {
      const token = "dummy-token";
      await setTokenCookie(token);

      expect(mockSet).toHaveBeenCalledTimes(3);
      expect(mockSet).toHaveBeenNthCalledWith(1, "token", token, expect.any(Object));
      expect(mockSet).toHaveBeenNthCalledWith(2, "csrf_token", expect.any(String), expect.any(Object));
      expect(mockSet).toHaveBeenNthCalledWith(3, SESSION_HINT_COOKIE, "1", expect.any(Object));
    });

    it("should give the session hint a shorter lifetime than the token", async () => {
      // The hint must expire before the JWT so a client/server desync self-heals on the
      // next page load instead of stranding a logged-in user in a logged-out UI.
      await setTokenCookie("dummy-token");

      const tokenOptions = mockSet.mock.calls[0][2];
      const hintOptions = mockSet.mock.calls[2][2];
      expect(hintOptions.maxAge).toBeLessThan(tokenOptions.maxAge);
    });

    it("should mark the session hint readable by client JS but never httpOnly-privileged", async () => {
      await setTokenCookie("dummy-token");

      const tokenOptions = mockSet.mock.calls[0][2];
      const hintOptions = mockSet.mock.calls[2][2];
      // The real session stays httpOnly; the hint is only a "should I even ask?" flag.
      expect(tokenOptions.httpOnly).toBe(true);
      expect(hintOptions.httpOnly).toBe(false);
    });

    it("should clear cookies on removeTokenCookie", async () => {
      await removeTokenCookie();

      expect(mockSet).toHaveBeenCalledTimes(3);
      expect(mockSet).toHaveBeenNthCalledWith(1, "token", "", expect.objectContaining({ maxAge: 0 }));
      expect(mockSet).toHaveBeenNthCalledWith(2, "csrf_token", "", expect.objectContaining({ maxAge: 0 }));
      // The hint must be cleared in lockstep with the token — never left behind.
      expect(mockSet).toHaveBeenNthCalledWith(3, SESSION_HINT_COOKIE, "", expect.objectContaining({ maxAge: 0 }));
    });

    it("should retrieve token from cookies", async () => {
      mockGet.mockReturnValue({ value: "stored-token" });
      const token = await getTokenFromCookie();
      expect(mockGet).toHaveBeenCalledWith("token");
      expect(token).toBe("stored-token");
    });
  });
});

describe("Authentication Guard (requireAuth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when token is missing", async () => {
    mockGet.mockReturnValue(undefined);
    const result = await requireAuth();

    expect(result.payload).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(401);
  });

  it("should return 401 when token is invalid", async () => {
    mockGet.mockReturnValue({ value: "invalid-token" });
    const result = await requireAuth();

    expect(result.payload).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(401);
  });

  it("should return payload when token is valid", async () => {
    const payload = { userId: "FSW-1001", email: "test@example.com", role: "customer" };
    const token = signToken(payload);
    mockGet.mockReturnValue({ value: token });

    const result = await requireAuth();
    expect(result.error).toBeUndefined();
    expect(result.payload).toBeDefined();
    expect(result.payload?.userId).toBe(payload.userId);
  });

  it("should return 403 when user does not have required role", async () => {
    const payload = { userId: "FSW-1001", email: "test@example.com", role: "customer" };
    const token = signToken(payload);
    mockGet.mockReturnValue({ value: token });

    const result = await requireAuth("admin");
    expect(result.payload).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(403);
  });
});

describe("Authentication Guard (requireAdminOrManagerAuth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return payload if role is admin", async () => {
    const payload = { userId: "FSW-ADMIN", email: "admin@example.com", role: "admin" };
    const token = signToken(payload);
    mockGet.mockReturnValue({ value: token });

    const result = await requireAdminOrManagerAuth("orders_b2b");
    expect(result.error).toBeUndefined();
    expect(result.payload).toBeDefined();
  });

  it("should return 403 and dispatch SECURITY_ALERT if manager lacks permission", async () => {
    const payload = { userId: "MGR-123", email: "mgr@example.com", role: "manager" };
    const token = signToken(payload);
    mockGet.mockReturnValue({ value: token });
    mockManagerFindById.mockResolvedValue({ status: "active", permissions: ["products_read"] });

    const result = await requireAdminOrManagerAuth("orders_b2b");
    
    expect(result.payload).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error?.status).toBe(403);
    
    const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
    expect(dispatchEventServer).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "SECURITY_ALERT",
      actor: expect.objectContaining({ role: "manager", id: "MGR-123" }),
      data: { attemptedPermission: "orders_b2b" }
    }));
  });

  it("should return payload if manager has exact permission", async () => {
    const payload = { userId: "MGR-123", email: "mgr@example.com", role: "manager" };
    const token = signToken(payload);
    mockGet.mockReturnValue({ value: token });
    mockManagerFindById.mockResolvedValue({ status: "active", permissions: ["orders_b2b:write"] });

    const result = await requireAdminOrManagerAuth("orders_b2b:write");
    
    expect(result.error).toBeUndefined();
    expect(result.payload).toBeDefined();
  });

  describe("verifyManagerOrderAccess", () => {
    it("should allow admin role unconditionally", async () => {
      const payload = { userId: "ADMIN-1", email: "admin@example.com", role: "admin" };
      const result = await verifyManagerOrderAccess(payload, { orderType: "B2B" });
      expect(result.allowed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should allow manager with matching orderType permission (e.g. orders_b2b)", async () => {
      const payload = { userId: "MGR-1", email: "mgr@example.com", role: "manager" };
      mockManagerFindById.mockResolvedValue({ status: "active", permissions: ["orders_b2b"] });
      const result = await verifyManagerOrderAccess(payload, { orderType: "B2B" });
      expect(result.allowed).toBe(true);
    });

    it("should allow manager with ops_shipping permission for any order", async () => {
      const payload = { userId: "MGR-1", email: "mgr@example.com", role: "manager" };
      mockManagerFindById.mockResolvedValue({ status: "active", permissions: ["ops_shipping"] });
      const result = await verifyManagerOrderAccess(payload, { orderType: "B2C" });
      expect(result.allowed).toBe(true);
    });

    it("should reject manager lacking matching order permission", async () => {
      const payload = { userId: "MGR-1", email: "mgr@example.com", role: "manager" };
      mockManagerFindById.mockResolvedValue({ status: "active", permissions: ["catalog_products"] });
      const result = await verifyManagerOrderAccess(payload, { orderType: "B2C" });
      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject inactive manager", async () => {
      const payload = { userId: "MGR-1", email: "mgr@example.com", role: "manager" };
      mockManagerFindById.mockResolvedValue({ status: "suspended", permissions: ["orders_b2b"] });
      const result = await verifyManagerOrderAccess(payload, { orderType: "B2B" });
      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});


describe("CSRF Protection", () => {
  it("should generate a CSRF token", () => {
    const token = generateCsrfToken();
    expect(token).toBeTypeOf("string");
    expect(token.length).toBeGreaterThan(10);
  });

  describe("validateCsrf", () => {
    it("should validate standard Request with matching tokens", () => {
      const csrfToken = "test-csrf-token";
      const request = new Request("http://localhost/api/test", {
        headers: {
          "x-csrf-token": csrfToken,
          "cookie": `csrf_token=${csrfToken}`,
        },
      });

      const isValid = validateCsrf(request);
      expect(isValid).toBe(true);
    });

    it("should invalidate standard Request with mismatched tokens", () => {
      const request = new Request("http://localhost/api/test", {
        headers: {
          "x-csrf-token": "token-a",
          "cookie": "csrf_token=token-b",
        },
      });

      const isValid = validateCsrf(request);
      expect(isValid).toBe(false);
    });

    it("should invalidate standard Request when token is missing", () => {
      const request = new Request("http://localhost/api/test", {
        headers: {
          "x-csrf-token": "token-a",
        },
      });

      const isValid = validateCsrf(request);
      expect(isValid).toBe(false);
    });
  });
});
