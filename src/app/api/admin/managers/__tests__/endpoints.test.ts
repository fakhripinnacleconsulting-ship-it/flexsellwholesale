import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { emailService } from "@/lib/emailService";
import Manager from "@/models/Manager";

// Mock dependencies
vi.mock("@/lib/dbConnect", () => ({ default: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/auth", () => ({
  getTokenFromCookie: vi.fn().mockResolvedValue("mock-token"),
  verifyToken: vi.fn().mockReturnValue({ role: "admin" })
}));

vi.mock("@/lib/emailService", () => ({
  emailService: {
    sendManagerWelcomeEmail: vi.fn().mockResolvedValue(true)
  }
}));

const mockManagerCreate = vi.fn();
const mockManagerFindOne = vi.fn();
vi.mock("@/models/Manager", () => ({
  default: {
    findOne: () => mockManagerFindOne(),
    create: (...args: any[]) => mockManagerCreate(...args)
  }
}));

describe("POST /api/admin/managers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a manager and send welcome email", async () => {
    mockManagerFindOne.mockResolvedValue(null);
    mockManagerCreate.mockResolvedValue({
      _id: "mock-id",
      name: "New Manager",
      email: "newmgr@test.com",
      toObject: () => ({ name: "New Manager", email: "newmgr@test.com" })
    });

    const request = new Request("http://localhost/api/admin/managers", {
      method: "POST",
      body: JSON.stringify({
        name: "New Manager",
        email: "newmgr@test.com",
        password: "securepass"
      })
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    // Verify welcome email was triggered
    expect(emailService.sendManagerWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: "newmgr@test.com" }),
      "securepass"
    );
  });
});
