import { describe, it, expect, vi, beforeEach } from "vitest";
import { signToken, verifyToken, setTokenCookie, removeTokenCookie, getTokenFromCookie } from "../auth";
import { requireAuth } from "../authGuard";
import { generateCsrfToken, validateCsrf } from "../csrf";

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

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(1, "token", token, expect.any(Object));
      expect(mockSet).toHaveBeenNthCalledWith(2, "csrf_token", expect.any(String), expect.any(Object));
    });

    it("should clear cookies on removeTokenCookie", async () => {
      await removeTokenCookie();

      expect(mockSet).toHaveBeenCalledTimes(2);
      expect(mockSet).toHaveBeenNthCalledWith(1, "token", "", expect.objectContaining({ maxAge: 0 }));
      expect(mockSet).toHaveBeenNthCalledWith(2, "csrf_token", "", expect.objectContaining({ maxAge: 0 }));
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
