import crypto from "crypto";
import { vercelBlobProvider, streamPrivateBlob } from "./vercelBlob";
import { mongoDocumentProvider, readStoredDocument } from "./mongoDocument";
import { cloudinaryProvider } from "./cloudinary";
import { supabaseStorageProvider } from "./supabaseStorage";
import {
  AllProvidersFailedError,
  StorageError,
  UPLOAD_KIND_RULES,
  type AssetClass,
  type ProviderName,
  type StorageFailureKind,
  type StorageProvider,
  type UploadKind,
  type UploadResult,
} from "./types";

export * from "./types";
export { streamPrivateBlob, readStoredDocument };

/**
 * The only way anything in this application writes a file.
 *
 * Before this module there were two upload routes with different fallbacks, different limits
 * and different return shapes, plus eight components calling `fetch` directly. Consolidating
 * them is not tidiness: the bandwidth incident came from one of those routes storing a proxy
 * URL, and with the logic in eight places there was nowhere to fix it once.
 *
 * Providers are tried in order. The **first configured** provider that succeeds wins; a
 * provider that reports itself unavailable (suspended store, rate limit, outage) is skipped
 * and the next one gets a turn. A provider that rejects the *file* stops the chain — retrying
 * a refused content type elsewhere would store something the first provider deliberately
 * declined.
 */

/**
 * Provider order, by asset class — the two classes want opposite things.
 *
 * **Public** assets are served on every page view, so a CDN is the whole point: blob first.
 *
 * **Private** documents go to the database first, and that is not a fallback ordering. A
 * public Vercel Blob store refuses `access: "private"` outright, so on a store marked Public
 * — which is the default — every KYC and payment-proof upload failed regardless of the token.
 * Beyond that, a private document should have no URL that reads it, and the database is the
 * only option here that offers none. Documents are small and rarely read; they were the wrong
 * thing to have made a CDN's problem in the first place.
 */
const PUBLIC_PROVIDERS: StorageProvider[] = [
  vercelBlobProvider,
  cloudinaryProvider,
  supabaseStorageProvider,
];

const PRIVATE_PROVIDERS: StorageProvider[] = [
  mongoDocumentProvider,
  // Kept behind Mongo so a store that *is* configured for private access can still be used,
  // and so nothing breaks if the database is ever taken out of this path.
  vercelBlobProvider,
  cloudinaryProvider,
  supabaseStorageProvider,
];

function providersFor(assetClass: AssetClass): StorageProvider[] {
  return assetClass === "private" ? PRIVATE_PROVIDERS : PUBLIC_PROVIDERS;
}

/** Every provider, for operations that must find a file without knowing who stored it. */
const ALL_PROVIDERS: StorageProvider[] = [
  mongoDocumentProvider,
  vercelBlobProvider,
  cloudinaryProvider,
  supabaseStorageProvider,
];

/** How long a private document's direct URL stays valid. Long enough to load, short enough to leak harmlessly. */
export const SIGNED_URL_TTL_SECONDS = 300;

export interface UploadFileInput {
  buffer: Buffer;
  filename: string;
  contentType: string;
  kind: UploadKind;
}

/** Strips anything that could escape the intended folder or confuse a URL. */
function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9.-]/g, "_").slice(-120);
}

/**
 * Builds the object path.
 *
 * The UUID is what makes an object immutable and therefore safe to cache for a year, and it
 * is also what stops a caller guessing another customer's document path.
 */
function buildPathname(kind: UploadKind, filename: string): string {
  const { prefix } = UPLOAD_KIND_RULES[kind];
  return `${prefix}/${crypto.randomUUID()}-${safeFilename(filename)}`;
}

export function validateUpload(
  kind: UploadKind,
  contentType: string,
  byteLength: number
): { ok: true } | { ok: false; message: string } {
  const rule = UPLOAD_KIND_RULES[kind];
  if (!rule) return { ok: false, message: `Unknown upload kind "${kind}".` };

  if (!rule.mimeTypes.includes(contentType)) {
    return {
      ok: false,
      message: `This file type is not accepted here. Allowed: ${rule.mimeTypes
        .map((m) => m.split("/")[1])
        .join(", ")}.`,
    };
  }

  if (byteLength > rule.maxBytes) {
    return {
      ok: false,
      message: `File too large (${(byteLength / (1024 * 1024)).toFixed(1)} MB). Maximum is ${Math.round(
        rule.maxBytes / (1024 * 1024)
      )} MB.`,
    };
  }

  return { ok: true };
}

export async function uploadFile(input: UploadFileInput): Promise<UploadResult> {
  const rule = UPLOAD_KIND_RULES[input.kind];
  const pathname = buildPathname(input.kind, input.filename);

  const attempts: Array<{ provider: ProviderName; kind: StorageFailureKind; message: string }> = [];

  for (const provider of providersFor(rule.assetClass)) {
    if (!provider.isConfigured()) continue;

    try {
      return await provider.upload({
        body: input.buffer,
        pathname,
        contentType: input.contentType,
        assetClass: rule.assetClass,
      });
    } catch (err) {
      const storageError =
        err instanceof StorageError
          ? err
          : new StorageError("UPLOAD_FAILED", (err as Error)?.message || "Upload failed", provider.name, err);

      attempts.push({
        provider: provider.name,
        kind: storageError.kind,
        message: storageError.message,
      });

      console.warn(`[storage] ${provider.name} failed (${storageError.kind}): ${storageError.message}`);

      // The file itself was refused — every other provider would refuse it too, and one that
      // did not would be storing something we already decided was invalid.
      if (storageError.kind === "UPLOAD_FAILED") break;
    }
  }

  throw new AllProvidersFailedError(attempts);
}

/**
 * Removes a stored object.
 *
 * `put` without `del` is a leak, and until now the codebase had no `del` anywhere — which is
 * why storage only ever grew. Never throws: a failed cleanup must not fail the user-facing
 * action that triggered it, and the orphan sweep is the backstop.
 */
export async function deleteFile(ref: string | undefined | null, assetClass: AssetClass): Promise<void> {
  if (!ref) return;

  // Legacy proxy URLs still name the real object in their query string.
  const normalised = extractLegacyBlobUrl(ref) ?? ref;

  for (const provider of providersFor(assetClass)) {
    if (!provider.isConfigured()) continue;
    try {
      await provider.remove(normalised, assetClass);
      return;
    } catch (err) {
      console.error(`[storage] delete failed on ${provider.name}:`, err);
    }
  }
}

/**
 * A short-lived direct URL for a private object, or `null` when the provider cannot mint one.
 *
 * `null` is not an error — the caller falls back to streaming. Returning a URL is simply the
 * cheaper path when it is available, because the bytes then travel from the CDN to the
 * browser without passing through a function.
 */
export async function signedUrlFor(ref: string): Promise<string | null> {
  for (const provider of ALL_PROVIDERS) {
    if (!provider.isConfigured() || !provider.signedUrl) continue;
    const url = await provider.signedUrl(ref, SIGNED_URL_TTL_SECONDS);
    if (url) return url;
  }
  return null;
}

/**
 * Pulls the real blob URL out of a legacy proxy reference.
 *
 * Historic rows hold `/api/customers/document/<name>?url=<blobUrl>`. Reading those has to
 * keep working until the migration has run everywhere, so this is the one place that
 * understands the old shape. Returns `null` for anything already in the new format.
 */
export function extractLegacyBlobUrl(ref: string): string | null {
  if (!ref.includes("/api/customers/document/")) return null;
  const queryIndex = ref.indexOf("?");
  if (queryIndex === -1) return null;
  const params = new URLSearchParams(ref.slice(queryIndex + 1));
  return params.get("url");
}

/** True when a stored reference is a legacy proxy path rather than a URL or pathname. */
export function isLegacyProxyRef(ref: string): boolean {
  return ref.includes("/api/customers/document/");
}
