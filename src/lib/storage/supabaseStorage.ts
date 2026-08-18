import {
  StorageError,
  type AssetClass,
  type StorageProvider,
  type UploadInput,
  type UploadResult,
} from "./types";

/**
 * Fallback #2 — the last resort, reached only when both Blob and Cloudinary decline.
 *
 * Supabase Storage speaks plain REST over HTTP, so this needs no SDK either. Two buckets
 * keep the asset classes physically separated: a public bucket the CDN serves, and a private
 * bucket that only ever hands out signed URLs. One bucket with per-object policies would
 * work, but a misconfigured policy would silently publish KYC documents — separate buckets
 * make that mistake impossible to make quietly.
 */

const PUBLIC_BUCKET = process.env.SUPABASE_PUBLIC_BUCKET || "flexsell-public";
const PRIVATE_BUCKET = process.env.SUPABASE_PRIVATE_BUCKET || "flexsell-private";

interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

function parseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/+$/, ""), serviceKey };
}

function bucketFor(assetClass: AssetClass): string {
  return assetClass === "private" ? PRIVATE_BUCKET : PUBLIC_BUCKET;
}

function authHeaders(config: SupabaseConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.serviceKey}`,
    apikey: config.serviceKey,
  };
}

export const supabaseStorageProvider: StorageProvider = {
  name: "supabase",

  isConfigured() {
    return parseConfig() !== null;
  },

  async upload({ body, pathname, contentType, assetClass }: UploadInput): Promise<UploadResult> {
    const config = parseConfig();
    if (!config) {
      throw new StorageError("PROVIDER_MISCONFIGURED", "Supabase Storage is not configured.", "supabase");
    }

    const bucket = bucketFor(assetClass);
    const endpoint = `${config.url}/storage/v1/object/${bucket}/${pathname}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...authHeaders(config),
          "Content-Type": contentType,
          // Public objects are immutable — the pathname carries a UUID — so a year is safe.
          "Cache-Control": assetClass === "public" ? "public, max-age=31536000, immutable" : "no-store",
        },
        body: new Uint8Array(body),
      });
    } catch (err) {
      throw new StorageError("PROVIDER_UNAVAILABLE", "Could not reach Supabase Storage.", "supabase", err);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const kind =
        response.status === 401 || response.status === 403
          ? "PROVIDER_MISCONFIGURED"
          : response.status === 429 || response.status >= 500
            ? "PROVIDER_UNAVAILABLE"
            : "UPLOAD_FAILED";
      throw new StorageError(kind, `Supabase rejected the upload (${response.status}). ${text}`, "supabase");
    }

    return {
      ref:
        assetClass === "public"
          ? `${config.url}/storage/v1/object/public/${bucket}/${pathname}`
          : pathname,
      assetClass,
      provider: "supabase",
    };
  },

  async remove(ref: string, assetClass: AssetClass): Promise<void> {
    const config = parseConfig();
    if (!config) return;

    const bucket = bucketFor(assetClass);
    const pathname = assetClass === "public" ? ref.split(`/public/${bucket}/`).pop() || "" : ref;
    if (!pathname) return;

    await fetch(`${config.url}/storage/v1/object/${bucket}/${pathname}`, {
      method: "DELETE",
      headers: authHeaders(config),
    }).catch((err) => console.error("[storage] Supabase delete failed:", err));
  },

  async signedUrl(ref: string, expiresInSeconds: number): Promise<string | null> {
    const config = parseConfig();
    if (!config) return null;

    try {
      const response = await fetch(
        `${config.url}/storage/v1/object/sign/${PRIVATE_BUCKET}/${ref}`,
        {
          method: "POST",
          headers: { ...authHeaders(config), "Content-Type": "application/json" },
          body: JSON.stringify({ expiresIn: expiresInSeconds }),
        }
      );
      if (!response.ok) return null;

      const { signedURL } = (await response.json()) as { signedURL?: string };
      return signedURL ? `${config.url}/storage/v1${signedURL}` : null;
    } catch (err) {
      console.warn("[storage] Supabase signing failed:", (err as Error)?.message);
      return null;
    }
  },
};
