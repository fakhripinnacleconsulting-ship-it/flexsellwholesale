import * as jwt from "jsonwebtoken";

/**
 * A short-lived pass to view **one** document, for someone who has no session yet.
 *
 * Registration and public order creation both upload documents before an account exists, so
 * requiring a session to view them would mean an applicant cannot check the file they just
 * attached. Requiring one is the correct default everywhere else — these documents are
 * Aadhaar, PAN and cancelled cheques — so the exception is made as narrow as it can be:
 *
 *   - scoped to a **single** document path, not to documents in general;
 *   - **signed**, so it cannot be forged or edited to name a different file;
 *   - **short-lived**, so a link pasted somewhere stops working quickly;
 *   - issued **only to the uploader**, in the upload response, and never derivable from a path.
 *
 * It is a receipt for something you just handed over, not a key to the filing cabinet.
 */

const JWT_SECRET = process.env.JWT_SECRET as string;

/**
 * Long enough to finish a registration form at an unhurried pace, short enough that a link
 * copied out of the address bar is useless by the time it is shared.
 */
const PREVIEW_TTL_SECONDS = 30 * 60;

interface DocumentTokenPayload {
  /** The one document path this token admits. */
  ref: string;
  purpose: "document-preview";
}

/** Issues a pass for one freshly uploaded document. */
export function issueDocumentPreviewToken(ref: string): string {
  return jwt.sign({ ref, purpose: "document-preview" } satisfies DocumentTokenPayload, JWT_SECRET, {
    expiresIn: PREVIEW_TTL_SECONDS,
  });
}

/**
 * Checks a pass against the document actually being requested.
 *
 * Comparing `payload.ref` to the requested path is the part that matters: without it a valid
 * token for one document would open every document, which is the hole this is meant to avoid.
 */
export function verifyDocumentPreviewToken(token: string | null, requestedRef: string): boolean {
  if (!token) return false;

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as DocumentTokenPayload;
    return payload.purpose === "document-preview" && payload.ref === requestedRef;
  } catch {
    // Expired, tampered with, or signed by something else — all the same answer.
    return false;
  }
}
