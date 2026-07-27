import { describe, it, expect } from "vitest";
import { validateCustomerKycRequirements, hasUploadedKycDoc } from "../kycValidationHelper";

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

  it("should fail validation for B2B customer missing company name and KYC documents", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["B2B"],
      company: "",
      gstin: "",
      kycDocuments: {},
    });
    expect(res.isValid).toBe(false);
    expect(res.missingFields).toContain("Company Name or GSTIN");
    expect(res.missingFields.some((f) => f.includes("KYC Verification Document"))).toBe(true);
  });

  it("should fail validation for B2B customer with company name but missing KYC documents", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["B2B"],
      company: "Acme Wholesale Corp",
      gstin: "24AAACA1234A1Z5",
      kycDocuments: {},
    });
    expect(res.isValid).toBe(false);
    expect(res.missingFields.length).toBe(1);
    expect(res.missingFields[0]).toContain("KYC Verification Document");
  });

  it("should pass validation for B2B customer with company name and at least 1 KYC document", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["B2C", "B2B"],
      company: "Acme Wholesale Corp",
      kycDocuments: {
        gstCertificate: "https://uploads.flexsell.com/docs/gst-cert.pdf",
      },
    });
    expect(res.isValid).toBe(true);
    expect(res.missingFields.length).toBe(0);
  });

  it("should fail validation for Dropshipping customer missing store name and KYC docs", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["Dropshipping"],
      storeName: "",
      company: "",
      kycDocuments: {},
    });
    expect(res.isValid).toBe(false);
    expect(res.missingFields).toContain("Online Store Name");
  });

  it("should pass validation for Dropshipping customer with store name and 1 KYC doc", () => {
    const res = validateCustomerKycRequirements({
      customerTypes: ["Dropshipping"],
      storeName: "FastShip Store",
      kycDocuments: {
        panCard: "https://uploads.flexsell.com/docs/pancard.jpg",
      },
    });
    expect(res.isValid).toBe(true);
  });

  it("should correctly evaluate hasUploadedKycDoc", () => {
    expect(hasUploadedKycDoc({})).toBe(false);
    expect(hasUploadedKycDoc({ gstCertificate: "" })).toBe(false);
    expect(hasUploadedKycDoc({ aadharCard: "https://example.com/doc.pdf" })).toBe(true);
  });
});
