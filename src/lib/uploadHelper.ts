import { apiClient } from "@/lib/apiClient";
import type { UploadKind } from "@/lib/storage/types";

/**
 * The only way a component uploads a file.
 *
 * Two jobs, both of which were previously missing everywhere:
 *
 *  1. **Compress before the bytes leave the browser.** Vercel bills egress on what is stored,
 *     so a 5 MB phone photo costs 5 MB on every single view, forever. Compressing it to
 *     ~200 KB up front is a ~95% reduction that no amount of server-side caching can match,
 *     because the cheapest byte is the one never stored.
 *
 *  2. **Go through the service layer.** Eight components each ran their own `fetch`, which is
 *     what [AGENTS.md](AGENTS.md) forbids and why the proxy-URL bug had to be fixed in one
 *     place but could have been introduced in eight.
 *
 * `browser-image-compression` is imported dynamically so its ~40 KB never lands in a bundle
 * that does not upload anything.
 */

export interface UploadOptions {
  /** Decides the size cap, accepted types, and whether the object is public or private. */
  kind: UploadKind;
  /** Skip compression — for a file that is already optimised, or where fidelity matters. */
  skipCompression?: boolean;
  onProgress?: (percent: number) => void;
}

export interface UploadedFile {
  /** Store this. Public assets get a CDN URL; private ones get an authenticated serving path. */
  url: string;
  /** The raw provider reference — the blob pathname for private objects. */
  ref: string;
  assetClass: "public" | "private";
}

/** Roughly 1 MB. Anything under this is already small enough that recompressing costs quality for nothing. */
const COMPRESSION_FLOOR_BYTES = 1024 * 1024;

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  // Kept as-is rather than forced to WebP: an admin who uploads a PNG logo with transparency
  // should get a PNG back. The size target does the work; the format does not need to.
  initialQuality: 0.8,
};

function isCompressibleImage(file: File): boolean {
  // GIF is excluded deliberately — compressing an animated GIF flattens it to a single frame.
  return ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type);
}

/**
 * Compresses when it will help, and returns the original when it will not.
 *
 * Never throws: a compression failure must not block the upload. A larger file that arrives
 * is better than a smaller one that does not.
 */
export async function compressIfImage(file: File): Promise<File> {
  if (!isCompressibleImage(file) || file.size <= COMPRESSION_FLOOR_BYTES) return file;

  try {
    const { default: imageCompression } = await import("browser-image-compression");
    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);

    // Compression can occasionally inflate an already-optimised image. Keep whichever is smaller.
    if (compressed.size >= file.size) return file;

    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });
  } catch (err) {
    console.warn("[upload] Compression failed; sending the original file.", err);
    return file;
  }
}

/**
 * Compresses, uploads, and returns what the caller should persist.
 *
 * Throws with a readable message when every storage provider is unavailable, so a suspended
 * blob store reads as "storage is unavailable" rather than the previous generic 500.
 */
export async function uploadWithCompression(
  file: File,
  options: UploadOptions
): Promise<UploadedFile> {
  const prepared = options.skipCompression ? file : await compressIfImage(file);

  const formData = new FormData();
  formData.append("file", prepared);
  formData.append("kind", options.kind);

  try {
    const result = await apiClient.post<UploadedFile>("/upload", formData);
    if (!result?.url) throw new Error("The upload returned no URL.");
    return result;
  } catch (err) {
    const message = (err as Error)?.message || "";
    /**
     * The server distinguishes a suspended store from a transient outage, and so must this:
     * telling someone to retry in a few minutes is wrong advice when the store will still be
     * suspended tomorrow. Pass the server's own wording through in that case rather than
     * overwriting it with a hopeful one.
     */
    if (message.includes("STORAGE_SUSPENDED") || message.includes("will not clear on its own")) {
      throw new Error(
        "File uploads are switched off at the moment. Please tell an administrator — this needs to be fixed on the hosting account."
      );
    }
    if (message.includes("STORAGE_UNAVAILABLE") || message.includes("storage is temporarily unavailable")) {
      throw new Error("File storage is temporarily unavailable. Please try again in a few minutes.");
    }
    throw err;
  }
}

/** Convenience for the common case: upload and keep only the URL. */
export async function uploadFileAndGetUrl(file: File, kind: UploadKind): Promise<string> {
  const { url } = await uploadWithCompression(file, { kind });
  return url;
}
