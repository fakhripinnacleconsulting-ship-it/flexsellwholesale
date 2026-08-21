import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";
import { issueDocumentPreviewToken } from "@/lib/documentAccess";
import {
  uploadFile,
  validateUpload,
  AllProvidersFailedError,
  UPLOAD_KIND_RULES,
  type UploadKind,
} from "@/lib/storage";

export const maxDuration = 60;

/**
 * The single upload endpoint.
 *
 * Replaces two routes that had drifted apart: this one returned a direct URL, while
 * `/api/customers/upload-document` returned a **proxy** path that was then stored in Mongo —
 * so every later view of a document was served by a serverless function that fetched the blob
 * and re-streamed it. Two billed egresses per view, no CDN caching, and 255 MB of storage
 * producing 10 GB of transfer.
 *
 * `kind` decides everything that used to differ between the two routes: who may call, the
 * size cap, the accepted content types, and — the part that matters most — whether the object
 * is public (CDN URL stored) or private (pathname stored, served behind auth).
 */

/** Who may upload each kind. `"anonymous"` covers signed-out visitors on public pages. */
const KIND_ACCESS: Record<UploadKind, Array<"admin" | "manager" | "customer" | "anonymous">> = {
  // CMS and catalogue assets are public, cached for a year, and staff-authored. Nobody else
  // has any reason to write one.
  image: ["admin", "manager"],
  video: ["admin", "manager"],

  /**
   * KYC and dropship documents are uploaded on **public pages, before an account exists**:
   * `/register` collects KYC for a B2B or Dropshipping signup, and the public `/create-order`
   * page attaches Amazon invoices. Requiring a session here does not make anything safer — it
   * simply makes registration impossible, since the account is created *after* the documents
   * are attached.
   */
  kyc: ["admin", "manager", "customer", "anonymous"],
  dropship: ["admin", "manager", "customer", "anonymous"],

  // A payment proof is a record staff create about money already received. There is no public
  // page that produces one.
  proof: ["admin", "manager"],
};

/**
 * File signatures, checked against the actual bytes.
 *
 * `file.type` is supplied by the browser and a script can claim anything, so on the anonymous
 * path — the one reachable without an account — the content type is verified against what the
 * file really starts with. The route this consolidated used to do exactly this for KYC, and
 * dropping it would have been a regression hidden inside a refactor.
 */
const MAGIC_BYTES: Array<{ mime: string[]; bytes: number[] }> = [
  { mime: ["application/pdf"], bytes: [0x25, 0x50, 0x44, 0x46] },              // %PDF
  { mime: ["image/jpeg", "image/jpg"], bytes: [0xff, 0xd8, 0xff] },
  { mime: ["image/png"], bytes: [0x89, 0x50, 0x4e, 0x47] },
];

function looksLikeItsContentType(buffer: Buffer, contentType: string): boolean {
  // WebP carries "RIFF....WEBP"; it has no single fixed prefix, so it is matched separately.
  if (contentType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }

  const signature = MAGIC_BYTES.find((m) => m.mime.includes(contentType));
  if (!signature) return false;

  return signature.bytes.every((byte, i) => buffer[i] === byte);
}

function isUploadKind(value: string): value is UploadKind {
  return Object.prototype.hasOwnProperty.call(UPLOAD_KIND_RULES, value);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    /**
     * A missing session is not an error here.
     *
     * `/register` and the public `/create-order` page both attach documents before an account
     * exists, so the session is resolved and then used to decide *what may be uploaded*,
     * rather than to decide whether the request is allowed at all.
     */
    const auth = await requireAuth();
    const payload = auth.payload;
    const role = (payload?.role ?? "anonymous") as "admin" | "manager" | "customer" | "anonymous";
    const isAnonymous = !payload;

    /**
     * Signed-in uploads are keyed on the session — an office behind one NAT should not be
     * throttled as one abusive client. Anonymous uploads have nothing but the IP, and are
     * held to a tighter limit because that path needs no account to reach.
     */
    try {
      await rateLimit(
        isAnonymous ? `anon_upload_${(request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()}` : payload!.userId,
        "general"
      );
    } catch {
      return NextResponse.json(
        { message: "Too many uploads. Please try again in a moment." },
        { status: 429 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      console.error("FormData parse error in upload route:", err);
      return NextResponse.json(
        { message: "Upload failed or the payload exceeded the server limit. Try a smaller file." },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    // Defaults to `image` so the pre-existing callers that send no `kind` keep working
    // exactly as they did while they are migrated.
    const rawKind = String(formData.get("kind") || "image");
    if (!isUploadKind(rawKind)) {
      return NextResponse.json({ message: `Unknown upload kind "${rawKind}".` }, { status: 400 });
    }
    const kind: UploadKind = rawKind;

    if (!KIND_ACCESS[kind].includes(role)) {
      return NextResponse.json(
        {
          message: isAnonymous
            ? "Please sign in to upload this kind of file."
            : "You do not have permission to upload this kind of file.",
        },
        { status: isAnonymous ? 401 : 403 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const check = validateUpload(kind, contentType, buffer.byteLength);
    if (!check.ok) {
      return NextResponse.json({ message: check.message }, { status: 400 });
    }

    /**
     * On the anonymous path, trust the bytes rather than the label.
     *
     * `file.type` comes from the browser and a script can set it to anything, so a signed-out
     * caller could otherwise store an arbitrary payload under an image content type. Staff
     * uploads skip this: they are authenticated and attributable, and the check would reject
     * legitimate formats (SVG, AVIF, video) that have no single fixed signature.
     */
    if (isAnonymous && !looksLikeItsContentType(buffer, contentType)) {
      return NextResponse.json(
        { message: "That file does not look like a valid PDF or image. Please upload the original file." },
        { status: 400 }
      );
    }

    const result = await uploadFile({
      buffer,
      filename: file.name || "upload",
      contentType,
      kind,
    });

    /**
     * `url` is what the caller stores and renders.
     *
     * Public → the CDN URL itself, so the browser never calls us again for those bytes.
     * Private → our own authenticated serving path. The `ref` beside it is the raw pathname,
     * for callers that would rather persist that and build the path themselves.
     */
    let url: string;

    if (result.assetClass === "public") {
      url = result.ref;
    } else {
      const path = `/api/documents/${result.ref.split("/").map(encodeURIComponent).join("/")}`;

      /**
       * An anonymous uploader gets a short-lived pass to view this one document.
       *
       * Without it, the "View Tax Invoice" link on the public order page would answer 401 to
       * the very person who just attached the file. The token names a single path, is signed,
       * and expires — it lets someone check what they uploaded, and grants nothing else.
       */
      url = isAnonymous ? `${path}?t=${issueDocumentPreviewToken(result.ref)}` : path;
    }

    return NextResponse.json(
      { url, ref: result.ref, assetClass: result.assetClass, provider: result.provider },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    if (error instanceof AllProvidersFailedError) {
      // Name the real cause. The previous code answered "Serverless filesystem is read-only",
      // which described its own dead fallback rather than anything the operator could act on.
      console.error("[upload] every storage provider declined:", error.attempts);

      /**
       * A suspended store is not a blip, and telling someone to "try again shortly" is
       * actively wrong: a store suspended for exceeding its transfer quota stays suspended
       * until the plan is raised or the quota period rolls over. The two cases need
       * different words, and the operator needs the fix printed where they will see it.
       */
      const suspended = error.attempts.some((a) => /suspend/i.test(a.message));

      if (suspended) {
        console.error(
          "[upload] ACTION REQUIRED — the Vercel Blob store is suspended, which normally means " +
            "its data-transfer quota is exhausted. Uploads cannot succeed until you either " +
            "raise the plan or wait for the quota period to reset. To keep uploads working in " +
            "the meantime, set CLOUDINARY_URL and this route will use it automatically."
        );
      }

      return NextResponse.json(
        {
          message: suspended
            ? "File storage is not accepting uploads right now. This needs an administrator to resolve — it will not clear on its own."
            : "File storage is temporarily unavailable. Please try again in a few minutes.",
          code: suspended ? "STORAGE_SUSPENDED" : "STORAGE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    console.error("File upload failed:", error);
    return NextResponse.json(
      { message: (error as Error)?.message || "Failed to process the upload" },
      { status: 500 }
    );
  }
}
