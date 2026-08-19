/**
 * The storage contract every provider implements.
 *
 * One shape for Vercel Blob, Cloudinary and Supabase so a suspended primary is an env var
 * away from being bypassed rather than a deploy away. The alternative — provider checks
 * scattered through route handlers — is how the previous code ended up with two upload routes
 * that disagreed about what a successful upload even returns.
 */

/**
 * Public assets are cheap, cacheable and safe on a CDN. Private documents are identity
 * papers. Treating them identically is what produced both the bandwidth bill and the
 * exposure, so the distinction is a type, not a convention.
 */
export type AssetClass = "public" | "private";

/** What the caller is uploading. Decides asset class, size cap and accepted MIME types. */
export type UploadKind = "image" | "video" | "kyc" | "proof" | "dropship";

export type ProviderName = "vercel-blob" | "cloudinary" | "supabase" | "mongo";

export interface UploadKindRule {
  assetClass: AssetClass;
  maxBytes: number;
  mimeTypes: string[];
  /** Folder prefix inside the store. Keeps private and public objects visibly separated. */
  prefix: string;
}

/**
 * Size and type limits, server-enforced.
 *
 * Held here rather than in the route so the same numbers govern the client-side check, the
 * server check and the tests. A limit that lives in only one of those three is a limit that
 * drifts.
 */
export const UPLOAD_KIND_RULES: Record<UploadKind, UploadKindRule> = {
  image: {
    assetClass: "public",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/avif"],
    prefix: "public/images",
  },
  video: {
    assetClass: "public",
    maxBytes: 30 * 1024 * 1024,
    mimeTypes: ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska"],
    prefix: "public/videos",
  },
  kyc: {
    assetClass: "private",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"],
    prefix: "private/kyc",
  },
  proof: {
    assetClass: "private",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"],
    prefix: "private/proof",
  },
  dropship: {
    assetClass: "private",
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"],
    prefix: "private/dropship",
  },
};

export interface UploadInput {
  body: Buffer;
  /** Already sanitised by the caller; providers must not re-derive it from user input. */
  pathname: string;
  contentType: string;
  assetClass: AssetClass;
}

export interface UploadResult {
  /**
   * The value that goes into MongoDB.
   *
   * Public → absolute CDN URL. Private → the blob **pathname**, never a URL: a URL is either
   * permanently public or it expires, and a stored reference must be neither.
   */
  ref: string;
  assetClass: AssetClass;
  provider: ProviderName;
}

export interface StorageProvider {
  readonly name: ProviderName;
  /** False when the provider has no credentials configured — skipped without an attempt. */
  isConfigured(): boolean;
  upload(input: UploadInput): Promise<UploadResult>;
  remove(ref: string, assetClass: AssetClass): Promise<void>;
  /**
   * Resolves a private ref to something the browser can fetch directly.
   *
   * Returning `null` means "no direct URL available" and the caller falls back to streaming.
   * Only providers that can mint a short-lived signed URL return one.
   */
  signedUrl?(ref: string, expiresInSeconds: number): Promise<string | null>;
}

/**
 * Why an attempt failed, and therefore whether to try the next provider.
 *
 * The distinction matters: a suspended store should silently fall through, but a rejected
 * file type should not — retrying that elsewhere would store something the first provider
 * deliberately refused.
 */
export type StorageFailureKind = "PROVIDER_UNAVAILABLE" | "PROVIDER_MISCONFIGURED" | "UPLOAD_FAILED";

export class StorageError extends Error {
  constructor(
    readonly kind: StorageFailureKind,
    message: string,
    readonly provider?: ProviderName,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/** Thrown when every configured provider declined. Carries what was tried, for the log. */
export class AllProvidersFailedError extends Error {
  constructor(readonly attempts: Array<{ provider: ProviderName; kind: StorageFailureKind; message: string }>) {
    super(
      attempts.length === 0
        ? "No file storage is configured. Set BLOB_READ_WRITE_TOKEN, CLOUDINARY_URL or SUPABASE_URL."
        : `Upload failed on every configured provider: ${attempts.map((a) => `${a.provider} (${a.kind})`).join(", ")}`
    );
    this.name = "AllProvidersFailedError";
  }
}
