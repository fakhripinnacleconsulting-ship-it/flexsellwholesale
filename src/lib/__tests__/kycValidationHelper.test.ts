import { describe, it, expect } from "vitest";
import { validateCustomerKycRequirements } from "../kycValidationHelper";

describe("KYC Validation Helper Test Suite", () => {
  it("should pass validation for standard B2C customer without KYC documents", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["B2C"],
      company: "",
      kycDocuments: {},
    });
    expect(res.isValid).toBe(true);
    expect(res.missingFields.length).toBe(0);
  });

  it("should fail validation for B2B customer missing Aadhar or PAN", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["B2B"],
      company: "Acme Corp",
      kycDocuments: {
        gstCertificate: "https://example.com/gst.pdf", // optional for B2B
      },
    });
    expect(res.isValid).toBe(false);
    expect(res.missingFields).toContain("Aadhar Card Document");
    expect(res.missingFields).toContain("PAN Card Document");
  });

  it("should pass validation for B2B customer with Company Name, Aadhar Card, and PAN Card", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["B2C", "B2B"],
      company: "Acme Wholesale Corp",
      kycDocuments: {
        aadharCard: "https://example.com/aadhar.jpg",
        panCard: "https://example.com/pan.jpg",
      },
    });
    expect(res.isValid).toBe(true);
    expect(res.missingFields.length).toBe(0);
  });

  it("should fail validation for Dropshipping customer missing Store Name, GSTIN, Aadhar, PAN, or GST Cert", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["Dropshipping"],
      storeName: "",
      gstin: "",
      kycDocuments: {},
    });
    expect(res.isValid).toBe(false);
    expect(res.missingFields).toContain("Online Store Name");
    expect(res.missingFields).toContain("GSTIN");
    expect(res.missingFields).toContain("Aadhar Card Document");
    expect(res.missingFields).toContain("PAN Card Document");
    expect(res.missingFields).toContain("GST Certificate Document");
  });

  it("should pass validation for Dropshipping customer with Store Name, GSTIN, Aadhar, PAN, and GST Cert", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["Dropshipping"],
      storeName: "FastShip Store",
      gstin: "24AAACD1234A1Z5",
      kycDocuments: {
        aadharCard: "https://example.com/aadhar.jpg",
        panCard: "https://example.com/pan.jpg",
        gstCertificate: "https://example.com/gst.pdf",
      },
    });
    expect(res.isValid).toBe(true);
    expect(res.missingFields.length).toBe(0);
  });
});
