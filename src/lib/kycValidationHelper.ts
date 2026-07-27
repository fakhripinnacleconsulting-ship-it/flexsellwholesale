import { KycDocuments } from "@/types";

export interface KycValidationResult {
  isValid: boolean;
  errorMessage?: string;
  missingFields: string[];
}

export interface CustomerValidationInput {
  customerTypes?: string[];
  company?: string;
  storeName?: string;
  gstin?: string;
  kycDocuments?: KycDocuments;
}

/**
 * Checks if a specific document slot has a non-empty uploaded URL.
 */

export function isDocUploaded(url?: string): boolean {
  return typeof url === "string" && url.trim().length > 0;
}

/**
 * Checks if the customer has uploaded at least one valid KYC document.
 */
export function hasUploadedKycDoc(kycDocs?: KycDocuments): boolean {
  if (!kycDocs || typeof kycDocs !== "object") return false;
  return Object.values(kycDocs).some((url) => isDocUploaded(url));
}

/**
 * Validates business details and KYC document requirements based on customer types:
 * - Dropshipping: Brand/Store Name, GSTIN, Aadhar Card, PAN Card, and GST Certificate are MANDATORY.
 * - B2B: Company Name, Aadhar Card, and PAN Card are MANDATORY.
 * - Other documents (Signature, Passport, Cancelled Cheque) are OPTIONAL.
 */
export function validateCustomerKycRequirements(
  data: CustomerValidationInput
): KycValidationResult {
  const types = data.customerTypes || ["B2C"];
  const isB2B = types.includes("B2B");
  const isDropshipping = types.includes("Dropshipping");

  const missingFields: string[] = [];

  // Pure B2C account type does not require mandatory business fields or KYC docs
  if (!isB2B && !isDropshipping) {
    return { isValid: true, missingFields: [] };
  }

  const kyc = data.kycDocuments || {};

  // 1. Dropshipping Mandatory Requirements
  if (isDropshipping) {
    if (!data.storeName || !data.storeName.trim()) {
      missingFields.push("Online Store Name");
    }
    if (!data.gstin || !data.gstin.trim()) {
      missingFields.push("GSTIN");
    }
    if (!isDocUploaded(kyc.aadharCard)) {
      missingFields.push("Aadhar Card Document");
    }
    if (!isDocUploaded(kyc.panCard)) {
      missingFields.push("PAN Card Document");
    }
    if (!isDocUploaded(kyc.gstCertificate)) {
      missingFields.push("GST Certificate Document");
    }
  }

  // 2. B2B Mandatory Requirements
  if (isB2B) {
    if (!data.company || !data.company.trim()) {
      missingFields.push("Company Name");
    }
    if (!isDocUploaded(kyc.aadharCard) && !missingFields.includes("Aadhar Card Document")) {
      missingFields.push("Aadhar Card Document");
    }
    if (!isDocUploaded(kyc.panCard) && !missingFields.includes("PAN Card Document")) {
      missingFields.push("PAN Card Document");
    }
  }

  if (missingFields.length > 0) {
    const typeLabel = isDropshipping && isB2B ? "B2B & Dropshipping" : isDropshipping ? "Dropshipping" : "B2B";
    return {
      isValid: false,
      errorMessage: `Cannot proceed for ${typeLabel}: Missing mandatory item(s): ${missingFields.join(", ")}. Please complete required fields and upload mandatory KYC documents.`,
      missingFields,
    };
  }

  return { isValid: true, missingFields: [] };
}
