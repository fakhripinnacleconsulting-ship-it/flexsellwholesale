import dbConnect from "@/lib/dbConnect";
import StoredDocument from "@/models/StoredDocument";
import {
  StorageError,
  type StorageProvider,
  type UploadInput,
  type UploadResult,
} from "./types";

/**
 * Private documents, stored in MongoDB.
 *
 * The **primary** provider for the private asset class, ahead of every blob provider — not a
 * fallback. Two things forced that, and the first was found the hard way:
 *
 *  - A **public** Vercel Blob store refuses `access: "private"` outright, so on a Hobby store
 *    marked Public every KYC upload failed no matter how valid the token was.
 *  - A private document should have **no URL that reads it**. Bytes in Mongo, served only by
 *    an authenticated route, means a leaked link is not a disclosure — there is no link.
 *
 * It is also the one provider that cannot be suspended for exceeding a transfer quota, which
 * is what took uploads down in the first place. Documents are small and rarely read; they are
 * the wrong thing to have made a CDN's problem.
 */

/**
 * Refuses to hold this provider's own database.
 *
 * MongoDB's BSON limit is 16 MB per document. The upload rules cap private kinds well below
 * that, so this should be unreachable — it exists so that raising a limit somewhere else
 * fails loudly here instead of producing a write error nobody traces back.
 */
const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024;

export const mongoDocumentProvider: StorageProvider = {
  name: "mongo",

  /**
   * Always available. The application cannot serve a request without its database, so if this
   * check could fail the request would already have failed elsewhere.
   */
  isConfigured() {
    return Boolean(process.env.MONGODB_URI);
  },

  async upload({ body, pathname, contentType, assetClass }: UploadInput): Promise<UploadResult> {
    if (assetClass !== "private") {
      // Public assets belong on a CDN. Serving a product image out of Mongo would put a
      // function in front of every image on the storefront — the exact shape of the
      // bandwidth incident this whole design exists to undo.
      throw new StorageError(
        "PROVIDER_MISCONFIGURED",
        "Public assets are not stored in the database.",
        "mongo"
      );
    }

    if (body.byteLength > MAX_DOCUMENT_BYTES) {
      throw new StorageError(
        "UPLOAD_FAILED",
        `This document is too large to store (${(body.byteLength / (1024 * 1024)).toFixed(1)} MB).`,
        "mongo"
      );
    }

    try {
      await dbConnect();

      /**
       * `pathname` already carries the kind prefix and a UUID — reused verbatim as the `_id`
       * so a stored reference means the same thing whichever provider produced it.
       *
       * The prefix is built by `buildPathname` from `UPLOAD_KIND_RULES`, so it is always one
       * of the three; the narrowing is here so a future prefix change fails the type check
       * rather than writing a value the schema enum will reject at runtime.
       */
      const segment = pathname.split("/")[1];
      const kind: "kyc" | "proof" | "dropship" =
        segment === "proof" || segment === "dropship" ? segment : "kyc";

      await StoredDocument.create({
        _id: pathname,
        data: body,
        contentType,
        size: body.byteLength,
        originalName: pathname.split("/").pop(),
        kind,
      });

      return { ref: pathname, assetClass, provider: "mongo" };
    } catch (err) {
      throw new StorageError(
        "UPLOAD_FAILED",
        (err as Error)?.message || "Could not store the document.",
        "mongo",
        err
      );
    }
  },

  async remove(ref: string): Promise<void> {
    try {
      await dbConnect();
      await StoredDocument.deleteOne({ _id: ref });
    } catch (err) {
      console.error("[storage] Mongo document delete failed:", err);
    }
  },

  /**
   * No signed URL, deliberately.
   *
   * Returning `null` tells the serving route to stream the bytes through an authenticated
   * handler. That is the entire point of storing them here: there is no URL that reads this
   * document without a session behind it.
   */
  async signedUrl(): Promise<string | null> {
    return null;
  },
};

/**
 * Normalises whatever the driver hands back for a binary field into a Node `Buffer`.
 *
 * `.lean()` skips Mongoose's casting, so a `Buffer` field comes back as a **BSON `Binary`**
 * rather than a `Buffer`. `Buffer.from(binary)` does not throw on that — it quietly produces
 * an **empty** buffer, so the document served as a zero-byte file with no error anywhere.
 * Both shapes are handled here rather than dropping `.lean()`, which would hydrate a full
 * document just to read one field.
 */
function toBuffer(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;

  // BSON Binary exposes the bytes as `.buffer`; some driver versions offer `.value()`.
  const binary = value as { buffer?: Uint8Array; value?: () => Uint8Array };
  if (binary.buffer) return Buffer.from(binary.buffer);
  if (typeof binary.value === "function") return Buffer.from(binary.value());

  if (value instanceof Uint8Array) return Buffer.from(value);
  return null;
}

/** Reads a stored document back. Returns `null` when it does not exist. */
export async function readStoredDocument(
  ref: string
): Promise<{ data: Buffer; contentType: string; kind: string } | null> {
  await dbConnect();

  const doc = (await StoredDocument.findById(ref).lean()) as
    | { data?: unknown; contentType?: string; kind?: string }
    | null;

  const data = toBuffer(doc?.data);
  if (!data || data.byteLength === 0) return null;

  return {
    data,
    contentType: doc?.contentType || "application/octet-stream",
    kind: doc?.kind || "kyc",
  };
}
