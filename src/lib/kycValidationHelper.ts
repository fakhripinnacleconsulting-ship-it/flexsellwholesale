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
 * Checks if the customer has uploaded at least one valid KYC document.
 */
export function hasUploadedKycDoc(kycDocs?: KycDocuments): boolean {
  if (!kycDocs || typeof kycDocs !== "object") return false;
  return Object.values(kycDocs).some(
    (url) => typeof url === "string" && url.trim().length > 0
  );
}

/**
 * Validates business details and KYC document requirements when assigning
 * B2B or Dropshipping customer types.
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

  const hasKyc = hasUploadedKycDoc(data.kycDocuments);

  if (isB2B) {
    const hasBusinessId = Boolean(
      (data.company && data.company.trim()) || (data.gstin && data.gstin.trim())
    );
    if (!hasBusinessId) {
      missingFields.push("Company Name or GSTIN");
    }
    if (!hasKyc) {
      missingFields.push("At least 1 KYC Verification Document (e.g. GST Cert, PAN Card, or Aadhar)");
    }
  }

  if (isDropshipping) {
    const hasStore = Boolean(
      (data.storeName && data.storeName.trim()) || (data.company && data.company.trim())
    );
    if (!hasStore) {
      missingFields.push("Online Store Name");
    }
    if (!hasKyc) {
      if (!missingFields.some((f) => f.includes("KYC Verification Document"))) {
        missingFields.push("At least 1 KYC Verification Document (e.g. PAN Card, Aadhar, or GST Cert)");
      }
    }
  }

  if (missingFields.length > 0) {
    const requiredTypesStr = [];
    if (isB2B) requiredTypesStr.push("B2B");
    if (isDropshipping) requiredTypesStr.push("Dropshipping");

    return {
      isValid: false,
      errorMessage: `Cannot save Customer Type as ${requiredTypesStr.join(" / ")}: Mandatory details missing (${missingFields.join("; ")}). Please fill required fields and upload at least one KYC verification document.`,
      missingFields,
    };
  }

  return { isValid: true, missingFields: [] };
}
