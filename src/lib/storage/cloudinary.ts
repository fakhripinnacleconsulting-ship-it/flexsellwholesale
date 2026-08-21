import {
  StorageError,
  type AssetClass,
  type StorageProvider,
  type UploadInput,
  type UploadResult,
} from "./types";

/**
 * Fallback #1 — reached only when Vercel Blob is suspended, rate limited or unconfigured.
 *
 * Implemented against Cloudinary's REST API with `fetch` rather than their SDK: this file is
 * dormant in normal operation, and a dependency that ships in every bundle to cover an
 * outage is a poor trade. The signature is a plain SHA-1, which the Web Crypto API already
 * provides.
 *
 * Configured with a single `CLOUDINARY_URL` — `cloudinary://<key>:<secret>@<cloud_name>` —
 * because that is the one value Cloudinary itself hands you.
 */

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

function parseConfig(): CloudinaryConfig | null {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return null;

  const match = raw.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!match) {
    console.error("[storage] CLOUDINARY_URL is malformed. Expected cloudinary://key:secret@cloud_name");
    return null;
  }

  return { apiKey: match[1], apiSecret: match[2], cloudName: match[3] };
}

async function sha1Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Cloudinary signs the alphabetically-sorted parameter string, secret appended. */
async function sign(params: Record<string, string | number>, apiSecret: string): Promise<string> {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return sha1Hex(`${canonical}${apiSecret}`);
}

/**
 * Cloudinary splits uploads by media kind, and PDFs go to the `raw` endpoint rather than
 * `image`. Sending a PDF to `image` succeeds but then rasterises it on delivery, which is
 * not what a stored tax invoice should become.
 */
function resourceType(contentType: string): "image" | "video" | "raw" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "raw";
}

export const cloudinaryProvider: StorageProvider = {
  name: "cloudinary",

  isConfigured() {
    return parseConfig() !== null;
  },

  async upload({ body, pathname, contentType, assetClass }: UploadInput): Promise<UploadResult> {
    const config = parseConfig();
    if (!config) {
      throw new StorageError("PROVIDER_MISCONFIGURED", "Cloudinary is not configured.", "cloudinary");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    // Cloudinary derives the public id from the path; the extension is added on delivery.
    const publicId = pathname.replace(/\.[^./]+$/, "");

    const signedParams: Record<string, string | number> = {
      public_id: publicId,
      timestamp,
      // Private assets are delivered only through a signed URL, mirroring the blob provider.
      type: assetClass === "private" ? "private" : "upload",
    };

    const signature = await sign(signedParams, config.apiSecret);

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(body)], { type: contentType }));
    form.append("api_key", config.apiKey);
    form.append("public_id", publicId);
    form.append("timestamp", String(timestamp));
    form.append("type", String(signedParams.type));
    form.append("signature", signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType(contentType)}/upload`;

    let response: Response;
    try {
      response = await fetch(endpoint, { method: "POST", body: form });
    } catch (err) {
      // A network failure reaching Cloudinary is the provider being unavailable, not the
      // file being wrong — the next provider should still get a turn.
      throw new StorageError("PROVIDER_UNAVAILABLE", "Could not reach Cloudinary.", "cloudinary", err);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const kind =
        response.status === 401 || response.status === 403
          ? "PROVIDER_MISCONFIGURED"
          : response.status === 429 || response.status >= 500
            ? "PROVIDER_UNAVAILABLE"
            : "UPLOAD_FAILED";
      throw new StorageError(kind, `Cloudinary rejected the upload (${response.status}). ${text}`, "cloudinary");
    }

    const result = (await response.json()) as { secure_url?: string; public_id?: string };
    if (!result.secure_url || !result.public_id) {
      throw new StorageError("UPLOAD_FAILED", "Cloudinary returned no URL.", "cloudinary");
    }

    return {
      ref: assetClass === "public" ? result.secure_url : result.public_id,
      assetClass,
      provider: "cloudinary",
    };
  },

  async remove(ref: string, assetClass: AssetClass): Promise<void> {
    const config = parseConfig();
    if (!config) return;

    // A public ref is a delivery URL; the destroy API wants the public id back out of it.
    const publicId =
      assetClass === "public"
        ? decodeURIComponent(ref.split("/upload/").pop() || "").replace(/^v\d+\//, "").replace(/\.[^./]+$/, "")
        : ref;
    if (!publicId) return;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await sign({ public_id: publicId, timestamp }, config.apiSecret);

    const form = new FormData();
    form.append("public_id", publicId);
    form.append("timestamp", String(timestamp));
    form.append("api_key", config.apiKey);
    form.append("signature", signature);

    await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
      method: "POST",
      body: form,
    }).catch((err) => console.error("[storage] Cloudinary delete failed:", err));
  },

  /**
   * Cloudinary signs private delivery URLs with the same SHA-1 scheme, so a short-lived URL
   * needs no round trip — the signature is computed locally.
   */
  async signedUrl(ref: string, expiresInSeconds: number): Promise<string | null> {
    const config = parseConfig();
    if (!config) return null;

    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const toSign = `${expiresAt}/${ref}${config.apiSecret}`;
    const signature = (await sha1Hex(toSign)).slice(0, 16);

    return `https://res.cloudinary.com/${config.cloudName}/image/private/s--${signature}--/${ref}`;
  },
};
