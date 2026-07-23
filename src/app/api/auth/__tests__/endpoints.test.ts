import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as loginPOST } from "../login/route";
import { POST as registerPOST } from "../register/route";
import { POST as logoutPOST } from "../logout/route";
import { POST as forgotPasswordPOST } from "../forgot-password/route";
import { POST as resetPasswordPOST } from "../reset-password/route";
import Customer from "@/models/Customer";
import bcrypt from "bcryptjs";

// Mock nodemailer via global deferred mock structure to avoid hoisting temporal dead zone issues
const nodemailerSendMailMock = vi.fn().mockResolvedValue({});
const nodemailerCreateTransportMock = vi.fn().mockImplementation((opts) => {
  return {
    sendMail: nodemailerSendMailMock,
  };
});

(global as any).nodemailerMock = {
  createTransport: nodemailerCreateTransportMock,
  sendMail: nodemailerSendMailMock,
};

vi.mock("nodemailer", () => {
  return {
    default: {
      createTransport: vi.fn().mockImplementation((opts) => {
        return (global as any).nodemailerMock.createTransport(opts);
      }),
    },
  };
});

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

// Mock dbConnect
vi.mock("@/lib/dbConnect", () => {
  return {
    default: vi.fn().mockResolvedValue({}),
  };
});

// Mock rateLimit
vi.mock("@/lib/rateLimit", () => {
  return {
    rateLimit: vi.fn().mockResolvedValue(true),
  };
});

// Mock webhookDispatcher
vi.mock("@/lib/webhookDispatcher", () => {
  return {
    dispatchWebhook: vi.fn().mockResolvedValue({}),
  };
});

// Mock idGenerator
vi.mock("@/lib/idGenerator", () => {
  return {
    generateNextId: vi.fn().mockResolvedValue("FSW-0005"),
  };
});

vi.mock("@/models/Customer", () => {
  class MockCustomer {
    constructor(data: any) {
      Object.assign(this, data);
    }
    save = vi.fn().mockResolvedValue(true);
    toObject = vi.fn().mockReturnValue(this);
    static findOne = vi.fn();
    static findById = vi.fn();
  }
  return {
    default: MockCustomer,
  };
});

// Mock bcrypt
vi.mock("bcryptjs", () => {
  return {
    default: {
      compare: vi.fn(),
      hash: vi.fn(),
    },
  };
});

describe("Authentication API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "mauryatech7@gmail.com";
    process.env.SMTP_PASS = "qfxg glqf ymjh bksy";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  });

  describe("POST /api/auth/register", () => {
    const validRegistrationData = {
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      company: "Acme Corp",
      address: "123 Main St",
      city: "Metrocity",
      state: "StateName",
      pinCode: "123456",
      phone: "9876543210",
      gstin: "",
      customerTypes: ["B2B"],
    };

    it("should fail registration if email is already registered", async () => {
      // Mock existing customer
      (Customer.findOne as any).mockResolvedValue({ email: "john@example.com" });

      const request = new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify(validRegistrationData),
      });

      const response = await registerPOST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.message).toContain("already registered");
    });

    it("should successfully register a new customer", async () => {
      // Mock no existing customer
      (Customer.findOne as any).mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("hashed-password-123");

      const request = new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify(validRegistrationData),
      });

      const response = await registerPOST(request);
      expect(response.status).toBe(201);

      const body = await response.json();
      expect(body.message).toBe("Customer registered successfully");
      expect(body.customer).toBeDefined();
      expect(body.customer.email).toBe(validRegistrationData.email.toLowerCase());
      expect(mockSet).toHaveBeenCalled(); // Token cookie set
    });

    it("should fail validation with invalid input", async () => {
      const invalidData = {
        ...validRegistrationData,
        email: "not-an-email", // invalid email
        password: "123", // too short
      };

      const request = new Request("http://localhost/api/auth/register", {
        method: "POST",
        body: JSON.stringify(invalidData),
      });

      const response = await registerPOST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.message).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    const validLoginData = {
      identifier: "john@example.com",
      password: "password123",
    };

    it("should fail login if customer does not exist", async () => {
      (Customer.findOne as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify(validLoginData),
      });

      const response = await loginPOST(request);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.message).toBe("Invalid credentials");
    });

    it("should fail login if account is Google-only (no password set)", async () => {
      const mockCustomer = {
        _id: "FSW-0001",
        email: "john@example.com",
        password: "", // Google only user has no password
        role: "customer",
        toObject: function () { return this; }
      };
      (Customer.findOne as any).mockResolvedValue(mockCustomer);

      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify(validLoginData),
      });

      const response = await loginPOST(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.message).toContain("Google");
    });

    it("should fail login with incorrect password", async () => {
      const mockCustomer = {
        _id: "FSW-0001",
        email: "john@example.com",
        password: "hashedpassword",
        role: "customer",
        toObject: function () { return this; }
      };
      (Customer.findOne as any).mockResolvedValue(mockCustomer);
      (bcrypt.compare as any).mockResolvedValue(false);

      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify(validLoginData),
      });

      const response = await loginPOST(request);
      expect(response.status).toBe(401);
    });

    it("should log in successfully with correct credentials", async () => {
      const mockCustomer = {
        _id: "FSW-0001",
        email: "john@example.com",
        password: "hashedpassword",
        role: "customer",
        toObject: function () { return this; }
      };
      (Customer.findOne as any).mockResolvedValue(mockCustomer);
      (bcrypt.compare as any).mockResolvedValue(true);

      const request = new Request("http://localhost/api/auth/login", {
        method: "POST",
        body: JSON.stringify(validLoginData),
      });

      const response = await loginPOST(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe("Logged in successfully");
      expect(body.customer).toBeDefined();
      expect(mockSet).toHaveBeenCalled(); // Cookies should be set
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should clear the cookies on logout", async () => {
      const response = await logoutPOST();
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.message).toBe("Logged out successfully");
      expect(mockSet).toHaveBeenCalled(); // removeTokenCookie sets cookie with maxAge 0
    });
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should fail validation with invalid email format", async () => {
      const request = new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "not-an-email" }),
      });

      const response = await forgotPasswordPOST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toContain("email");
    });

    it("should return secure success message even if email is not found", async () => {
      (Customer.findOne as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "unknown@example.com" }),
      });

      const response = await forgotPasswordPOST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toContain("If that email is registered");
      expect(nodemailerCreateTransportMock).not.toHaveBeenCalled();
    });

    it("should generate token, save it to DB, and trigger SMTP email sending on existing email", async () => {
      const mockCustomer = {
        _id: "FSW-0001",
        email: "john@example.com",
        name: "John Doe",
        resetPasswordToken: undefined,
        resetPasswordExpires: undefined,
        save: vi.fn().mockResolvedValue(true),
      };
      (Customer.findOne as any).mockResolvedValue(mockCustomer);

      const request = new Request("http://localhost/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: "john@example.com" }),
      });

      const response = await forgotPasswordPOST(request);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.message).toContain("If that email is registered");
      expect(mockCustomer.resetPasswordToken).toBeDefined();
      expect(mockCustomer.resetPasswordExpires).toBeDefined();
      expect(mockCustomer.save).toHaveBeenCalled();
      
      // Verify SMTP transport call details
      expect(nodemailerCreateTransportMock).toHaveBeenCalledWith(expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: expect.objectContaining({
          user: "mauryatech7@gmail.com",
        }),
      }));
      expect(nodemailerSendMailMock).toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/reset-password", () => {
    it("should fail validation with invalid password", async () => {
      const request = new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: "some-token", password: "12" }), // password too short
      });

      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(400);
    });

    it("should fail if reset token is invalid or expired", async () => {
      (Customer.findOne as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: "invalid-token", password: "newpassword123" }),
      });

      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.message).toContain("Invalid or expired");
    });

    it("should successfully reset password and clear token fields on valid token", async () => {
      const mockCustomer = {
        _id: "FSW-0001",
        email: "john@example.com",
        password: "oldpasswordhash",
        resetPasswordToken: "valid-token",
        resetPasswordExpires: new Date(Date.now() + 3600000),
        save: vi.fn().mockResolvedValue(true),
      };
      (Customer.findOne as any).mockResolvedValue(mockCustomer);
      (bcrypt.hash as any).mockResolvedValue("newpasswordhash");

      const request = new Request("http://localhost/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: "valid-token", password: "newpassword123" }),
      });

      const response = await resetPasswordPOST(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toContain("Password reset successfully");

      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 10);
      expect(mockCustomer.password).toBe("newpasswordhash");
      expect(mockCustomer.resetPasswordToken).toBeUndefined();
      expect(mockCustomer.resetPasswordExpires).toBeUndefined();
      expect(mockCustomer.save).toHaveBeenCalled();
    });
  });
});
