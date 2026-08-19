import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";
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

/** Who may upload each kind. KYC is the only one a customer can send, and only their own. */
const KIND_ACCESS: Record<UploadKind, Array<"admin" | "manager" | "customer">> = {
  image: ["admin", "manager"],
  video: ["admin", "manager"],
  kyc: ["admin", "manager", "customer"],
  proof: ["admin", "manager"],
  dropship: ["admin", "manager"],
};

function isUploadKind(value: string): value is UploadKind {
  return Object.prototype.hasOwnProperty.call(UPLOAD_KIND_RULES, value);
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    // Keyed on the session rather than the IP: an office behind one NAT should not be
    // throttled as though it were a single abusive client.
    try {
      await rateLimit(payload.userId, "general");
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

    const allowedRoles = KIND_ACCESS[kind];
    if (!allowedRoles.includes(payload.role as "admin" | "manager" | "customer")) {
      return NextResponse.json(
        { message: "You do not have permission to upload this kind of file." },
        { status: 403 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";

    const check = validateUpload(kind, contentType, buffer.byteLength);
    if (!check.ok) {
      return NextResponse.json({ message: check.message }, { status: 400 });
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
    const url =
      result.assetClass === "public"
        ? result.ref
        : `/api/documents/${result.ref.split("/").map(encodeURIComponent).join("/")}`;

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
