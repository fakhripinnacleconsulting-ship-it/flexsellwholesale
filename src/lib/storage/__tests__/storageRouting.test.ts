import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression cover for the upload failure that took document uploads down entirely.
 *
 * A Vercel Blob store created as **Public** refuses `access: "private"`:
 *
 *     Vercel Blob: Cannot use private access on a public store.
 *
 * The SDK raises that as a plain `Error`, which the classifier read as `UPLOAD_FAILED` — and
 * `UPLOAD_FAILED` deliberately **stops** the provider chain, because a file one provider
 * refuses should not be retried elsewhere. So every KYC, payment-proof and dropship upload
 * failed on a Public store no matter how valid the token was, and no fallback ever ran.
 *
 * Two things fix it, and both are asserted here: the message is classified as a
 * *misconfiguration* so the chain continues, and private documents go to the database first
 * rather than to a CDN at all.
 */

vi.mock("@/lib/dbConnect", () => ({ default: vi.fn().mockResolvedValue(true) }));

const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockDeleteOne = vi.fn();
vi.mock("@/models/StoredDocument", () => ({
  default: {
    create: (...a: unknown[]) => mockCreate(...a),
    findById: (id: string) => ({ lean: () => mockFindById(id) }),
    deleteOne: (...a: unknown[]) => mockDeleteOne(...a),
  },
}));

const mockPut = vi.fn();
vi.mock("@vercel/blob", () => {
  class BlobError extends Error {}
  return {
    put: (...a: unknown[]) => mockPut(...a),
    del: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    issueSignedToken: vi.fn(),
    presignUrl: vi.fn(),
    head: vi.fn(),
    list: vi.fn(),
    BlobStoreSuspendedError: class extends BlobError {},
    BlobServiceRateLimited: class extends BlobError {},
    BlobServiceNotAvailable: class extends BlobError {},
    BlobStoreNotFoundError: class extends BlobError {},
    BlobAccessError: class extends BlobError {},
  };
});

import { uploadFile, readStoredDocument } from "../index";

describe("storage provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_secret";
    process.env.MONGODB_URI = "mongodb://test";
    delete process.env.CLOUDINARY_URL;
    delete process.env.SUPABASE_URL;
    mockCreate.mockResolvedValue({});
  });

  it("sends a public image to blob storage and stores its CDN URL", async () => {
    mockPut.mockResolvedValue({ url: "https://store.public.blob.vercel-storage.com/public/images/x.jpg" });

    const result = await uploadFile({
      buffer: Buffer.from([0xff, 0xd8]),
      filename: "x.jpg",
      contentType: "image/jpeg",
      kind: "image",
    });

    expect(result.provider).toBe("vercel-blob");
    expect(result.assetClass).toBe("public");
    expect(result.ref.startsWith("https://")).toBe(true);
    // A public asset is cached hard — it is immutable, its pathname carries a UUID.
    expect(mockPut.mock.calls[0][2]).toMatchObject({ access: "public", cacheControlMaxAge: 31536000 });
  });

  it("sends a private KYC document to the database, never to the CDN", async () => {
    const result = await uploadFile({
      buffer: Buffer.from("kyc bytes"),
      filename: "pan.pdf",
      contentType: "application/pdf",
      kind: "kyc",
    });

    expect(result.provider).toBe("mongo");
    expect(result.assetClass).toBe("private");
    // The stored reference is a pathname. There is no URL that reads this document.
    expect(result.ref).toMatch(/^private\/kyc\//);
    expect(result.ref.startsWith("http")).toBe(false);
    // Blob was never even attempted for a private document.
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("treats a public store refusing private access as a misconfiguration, not a file error", async () => {
    // Force the blob provider to be reached by making the database unavailable.
    delete process.env.MONGODB_URI;
    mockPut.mockRejectedValue(
      new Error("Vercel Blob: Cannot use private access on a public store. The store must be configured with private access.")
    );

    await expect(
      uploadFile({
        buffer: Buffer.from("x"),
        filename: "proof.pdf",
        contentType: "application/pdf",
        kind: "proof",
      })
    ).rejects.toMatchObject({
      name: "AllProvidersFailedError",
      // PROVIDER_MISCONFIGURED, not UPLOAD_FAILED — the distinction is what lets the chain
      // continue to a provider that can actually hold the document.
      attempts: [expect.objectContaining({ provider: "vercel-blob", kind: "PROVIDER_MISCONFIGURED" })],
    });
  });

  it("reads a stored document back through a BSON Binary, not just a Buffer", async () => {
    // `.lean()` returns BSON Binary rather than a Buffer, and `Buffer.from(binary)` silently
    // yields an empty buffer — which served every document as a zero-byte file.
    mockFindById.mockResolvedValue({
      data: { buffer: new Uint8Array([104, 105]) },
      contentType: "application/pdf",
      kind: "kyc",
    });

    const doc = await readStoredDocument("private/kyc/abc-pan.pdf");
    expect(doc?.data.toString()).toBe("hi");
    expect(doc?.contentType).toBe("application/pdf");
  });

  it("reports a zero-byte document as missing rather than serving an empty file", async () => {
    mockFindById.mockResolvedValue({ data: { buffer: new Uint8Array([]) }, contentType: "application/pdf" });
    expect(await readStoredDocument("private/kyc/empty.pdf")).toBeNull();
  });
});
