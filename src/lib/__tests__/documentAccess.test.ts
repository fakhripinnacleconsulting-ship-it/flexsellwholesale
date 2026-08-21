import { describe, it, expect, vi } from "vitest";
import { issueDocumentPreviewToken, verifyDocumentPreviewToken } from "../documentAccess";

/**
 * The pass that lets someone with no account view the document they just uploaded.
 *
 * Registration and public order creation both attach documents *before* an account exists, so
 * requiring a session to view one meant an applicant could not check their own upload. The
 * exception has to stay narrow, and these tests are what keeps it narrow: one document, signed,
 * and expiring.
 */
describe("document preview pass", () => {
  const ref = "private/kyc/9f1c-pan.pdf";

  it("admits the document it was issued for", () => {
    expect(verifyDocumentPreviewToken(issueDocumentPreviewToken(ref), ref)).toBe(true);
  });

  it("does not admit a different document", () => {
    // The whole point: a pass for one file must not open the filing cabinet.
    const token = issueDocumentPreviewToken(ref);
    expect(verifyDocumentPreviewToken(token, "private/kyc/other-aadhaar.pdf")).toBe(false);
    expect(verifyDocumentPreviewToken(token, "private/proof/someones-bill.pdf")).toBe(false);
  });

  it("rejects a missing, empty or tampered token", () => {
    expect(verifyDocumentPreviewToken(null, ref)).toBe(false);
    expect(verifyDocumentPreviewToken("", ref)).toBe(false);
    expect(verifyDocumentPreviewToken("not-a-jwt", ref)).toBe(false);
    expect(verifyDocumentPreviewToken(issueDocumentPreviewToken(ref) + "x", ref)).toBe(false);
  });

  it("expires", () => {
    const token = issueDocumentPreviewToken(ref);
    expect(verifyDocumentPreviewToken(token, ref)).toBe(true);

    // 31 minutes on: past the 30-minute window, so a link copied out of the address bar is
    // useless by the time anyone else could use it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
    expect(verifyDocumentPreviewToken(token, ref)).toBe(false);
    vi.useRealTimers();
  });
});
