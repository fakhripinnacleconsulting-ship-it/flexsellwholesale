import {
  put,
  del,
  get,
  issueSignedToken,
  presignUrl,
  BlobStoreSuspendedError,
  BlobServiceRateLimited,
  BlobServiceNotAvailable,
  BlobStoreNotFoundError,
  BlobAccessError,
} from "@vercel/blob";
import {
  StorageError,
  type AssetClass,
  type StorageProvider,
  type UploadInput,
  type UploadResult,
} from "./types";

/**
 * The primary provider.
 *
 * Two behaviours here are the whole point of this file:
 *
 *  1. **Public objects are written with a one-year cache and their CDN URL is what gets
 *     stored.** The previous code stored a proxy path instead, so every view was served by a
 *     serverless function that fetched the blob and re-streamed it — two billed egresses per
 *     view and no CDN caching at all. That is how 255 MB of storage produced 10 GB of transfer.
 *
 *  2. **Private objects are written with `access: "private"` and only their pathname is
 *     stored.** KYC holds Aadhaar, PAN and cheque images; publishing those to a CDN to save
 *     bandwidth would trade a bill for a data-protection incident.
 */

/** One year. Objects are content-addressed by a UUID in the name, so they never change. */
const PUBLIC_CACHE_MAX_AGE = 31_536_000;

function token(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Maps an SDK error onto "try the next provider" or "stop and tell the user".
 *
 * Uses the SDK's own error classes rather than matching on message text — the reason the
 * plan called for typed detection. A suspended store and a rejected content type both throw,
 * and only one of them should silently fall through to Cloudinary.
 */
function classify(err: unknown): StorageError {
  if (err instanceof BlobStoreSuspendedError) {
    return new StorageError("PROVIDER_UNAVAILABLE", "The blob store is suspended.", "vercel-blob", err);
  }
  if (err instanceof BlobServiceRateLimited) {
    return new StorageError("PROVIDER_UNAVAILABLE", "The blob service is rate limited.", "vercel-blob", err);
  }
  if (err instanceof BlobServiceNotAvailable) {
    return new StorageError("PROVIDER_UNAVAILABLE", "The blob service is unavailable.", "vercel-blob", err);
  }
  if (err instanceof BlobStoreNotFoundError || err instanceof BlobAccessError) {
    return new StorageError(
      "PROVIDER_MISCONFIGURED",
      "The blob store is missing or the token is not valid.",
      "vercel-blob",
      err
    );
  }

  /**
   * A **public** store refuses private objects outright:
   *
   *     Vercel Blob: Cannot use private access on a public store.
   *
   * The SDK raises this as a plain `Error`, which would otherwise be read as `UPLOAD_FAILED`
   * and stop the provider chain — so every KYC and payment-proof upload failed on a Public
   * store no matter how valid the token was, and the next provider never got a turn.
   *
   * It is a property of the store, not of the file, so it is a misconfiguration: fall through
   * and let a provider that *can* hold a private document take it.
   */
  const message = (err as Error)?.message || "";
  if (/private access on a public store|configured with private access/i.test(message)) {
    return new StorageError(
      "PROVIDER_MISCONFIGURED",
      "This blob store is public and cannot hold private documents.",
      "vercel-blob",
      err
    );
  }

  return new StorageError("UPLOAD_FAILED", message || "The blob upload failed.", "vercel-blob", err);
}

export const vercelBlobProvider: StorageProvider = {
  name: "vercel-blob",

  isConfigured() {
    return Boolean(token());
  },

  async upload({ body, pathname, contentType, assetClass }: UploadInput): Promise<UploadResult> {
    try {
      const result = await put(pathname, body, {
        access: assetClass === "private" ? "private" : "public",
        token: token(),
        contentType,
        // `addRandomSuffix: false` because the caller already put a UUID in the pathname.
        // Letting the SDK add its own would make the stored ref unpredictable, and a ref we
        // cannot reconstruct is a ref we cannot delete.
        addRandomSuffix: false,
        ...(assetClass === "public" ? { cacheControlMaxAge: PUBLIC_CACHE_MAX_AGE } : {}),
      });

      return {
        // Public: the CDN URL, so the browser never touches a function again.
        // Private: the pathname, resolved to a short-lived signed URL at read time.
        ref: assetClass === "public" ? result.url : pathname,
        assetClass,
        provider: "vercel-blob",
      };
    } catch (err) {
      throw classify(err);
    }
  },

  async remove(ref: string, assetClass: AssetClass): Promise<void> {
    // `del` accepts a URL or a pathname, which is exactly the two shapes `ref` can hold.
    await del(ref, { token: token() }).catch((err) => {
      // A delete that fails must not break the user-facing operation that triggered it.
      // The orphan sweep is the backstop for anything missed here.
      console.error(`[storage] Vercel Blob delete failed for ${assetClass} ref:`, err);
    });
  },

  /**
   * Mints a short-lived direct URL for a private object.
   *
   * A two-step delegation: `issueSignedToken` scopes a token to this one pathname and
   * operation, then `presignUrl` turns it into a URL the CDN will serve. Both calls return
   * a few hundred bytes — the file itself never passes through our function, which is what
   * separates this from the proxy it replaces.
   *
   * Returns `null` rather than throwing when the store cannot presign, so the caller can
   * fall back to streaming instead of failing the request.
   */
  async signedUrl(ref: string, expiresInSeconds: number): Promise<string | null> {
    try {
      const validUntil = Date.now() + expiresInSeconds * 1000;

      const signedToken = await issueSignedToken({
        token: token(),
        pathname: ref,
        operations: ["get"],
        validUntil,
      });

      const { presignedUrl } = await presignUrl(signedToken, {
        operation: "get",
        pathname: ref,
        access: "private",
        validUntil,
      });

      return presignedUrl;
    } catch (err) {
      console.warn("[storage] presignUrl unavailable, falling back to streaming:", (err as Error)?.message);
      return null;
    }
  },
};

/**
 * Streams a private object.
 *
 * The fallback for when `signedUrl` returns null. Deliberately returns the stream rather
 * than an ArrayBuffer: the route that this replaces called `arrayBuffer()`, which held whole
 * PDFs in function memory before responding.
 */
export async function streamPrivateBlob(
  pathname: string
): Promise<{ stream: ReadableStream; contentType: string } | null> {
  try {
    const result = await get(pathname, { access: "private", token: token() });
    if (!result) return null;
    return {
      stream: result.stream as ReadableStream,
      contentType: result.blob?.contentType || "application/octet-stream",
    };
  } catch (err) {
    console.error("[storage] Private blob read failed:", err);
    return null;
  }
}
