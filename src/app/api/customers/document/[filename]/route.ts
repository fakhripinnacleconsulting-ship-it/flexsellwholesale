import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Legacy document reader — **read-only compatibility, no new writes point here.**
 *
 * What this route used to be is worth stating plainly, because the shape of the fix follows
 * from it. It had:
 *
 *   - **no authentication at all** — any anonymous request could read any customer's Aadhaar,
 *     PAN, cheque image or GST certificate given a filename;
 *   - **a caller-supplied upstream URL** (`?url=`) fetched with the store's own read-write
 *     token, validated only by `includes(".blob.vercel-storage.com/")` — so it would fetch
 *     *any* Vercel Blob object, in any store, on anyone's behalf;
 *   - **no `Cache-Control`**, and a full `arrayBuffer()` of every file into function memory
 *     before responding.
 *
 * That last pair is why 255 MB of stored files generated 10 GB of transfer, and the first two
 * are why an unauthenticated endpoint that streams files is also a free bandwidth amplifier
 * for anyone who finds it.
 *
 * Now: authenticated, ownership-checked, and the `?url=` parameter is **ignored entirely**.
 * Once `scripts/migrate-document-urls.mjs` has run everywhere, nothing references this path
 * and it can be deleted.
 */

async function customerOwnsFilename(userId: string, filename: string): Promise<boolean> {
  const customer = (await Customer.findById(userId).select("kycDocuments").lean()) as
    | { kycDocuments?: Record<string, string | undefined> }
    | null;
  if (!customer?.kycDocuments) return false;

  return Object.values(customer.kycDocuments).some(
    (stored) => typeof stored === "string" && stored.includes(filename)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    try {
      await rateLimit(payload.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests." }, { status: 429 });
    }

    const { filename } = await params;
    const safeFilename = decodeURIComponent(filename);

    if (safeFilename.includes("..") || safeFilename.includes("/")) {
      return NextResponse.json({ message: "Invalid document name" }, { status: 400 });
    }

    const isStaff = payload.role === "admin" || payload.role === "manager";
    if (!isStaff) {
      await dbConnect();
      if (!(await customerOwnsFilename(payload.userId, safeFilename))) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    /**
     * Resolve the object from our **own** store, never from the request.
     *
     * The `?url=` parameter is deliberately not read. Legacy rows carry it, but the filename
     * alone identifies the object, and honouring a caller-supplied URL is precisely the hole
     * being closed. Legacy objects were written at the store root, so the pathname is the
     * bare filename.
     */
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      return NextResponse.json({ message: "Document storage is not configured" }, { status: 503 });
    }

    const { head } = await import("@vercel/blob");
    let objectUrl: string;
    try {
      const meta = await head(safeFilename, { token: blobToken });
      objectUrl = meta.url;
    } catch {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    /**
     * Redirect rather than stream.
     *
     * A 302 is a few hundred bytes; streaming the object through this function bills its full
     * size a second time and bypasses the CDN. `private` caching keeps the redirect out of
     * shared caches while still saving the same browser a round trip.
     */
    return NextResponse.redirect(objectUrl, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (err: unknown) {
    console.error("[documents:legacy] Failed to serve a document:", err);
    return NextResponse.json({ message: "Failed to load the document" }, { status: 500 });
  }
}
