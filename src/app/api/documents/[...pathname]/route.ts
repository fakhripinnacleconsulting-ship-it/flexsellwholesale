import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";
import { signedUrlFor, streamPrivateBlob, SIGNED_URL_TTL_SECONDS } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Serves a private document — KYC papers, payment proofs, dropship invoices.
 *
 * Replaces an endpoint with **no authentication of any kind**, which additionally took the
 * upstream URL from a `?url=` query parameter and fetched it with the store's own token. That
 * combination meant anyone who could guess a filename could read a customer's Aadhaar or PAN,
 * and anyone at all could point it at another store's blob and burn this store's bandwidth
 * doing it.
 *
 * Two rules follow from that, and both are structural rather than incidental:
 *
 *   1. **The caller never names the upstream object.** The path segment is a pathname inside
 *      our own store, resolved server-side. There is no parameter that can redirect the fetch.
 *   2. **Authorisation happens before any byte is fetched**, and a customer is only ever
 *      allowed their own documents.
 *
 * The happy path returns a 302 to a short-lived signed URL, so the file travels from the CDN
 * to the browser and never through this function — which is the bandwidth fix and the privacy
 * fix at the same time.
 */

/** Only paths this application actually writes. Anything else is a probe. */
const ALLOWED_PREFIXES = ["private/kyc/", "private/proof/", "private/dropship/"];

async function customerOwnsDocument(userId: string, ref: string): Promise<boolean> {
  const customer = (await Customer.findById(userId).select("kycDocuments").lean()) as
    | { kycDocuments?: Record<string, string | undefined> }
    | null;
  if (!customer?.kycDocuments) return false;

  return Object.values(customer.kycDocuments).some(
    (stored) => typeof stored === "string" && stored.includes(ref)
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pathname: string[] }> }
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

    const { pathname: segments } = await params;
    const ref = segments.map(decodeURIComponent).join("/");

    // Reject traversal outright rather than normalising it. A path that tries to escape is
    // not a path to repair.
    if (ref.includes("..") || ref.startsWith("/")) {
      return NextResponse.json({ message: "Invalid document path" }, { status: 400 });
    }

    if (!ALLOWED_PREFIXES.some((prefix) => ref.startsWith(prefix))) {
      return NextResponse.json({ message: "Invalid document path" }, { status: 400 });
    }

    const isStaff = payload.role === "admin" || payload.role === "manager";

    if (!isStaff) {
      // A customer may read their own KYC and nothing else. Proofs and dropship documents are
      // internal records about a customer, not documents belonging to them.
      await dbConnect();
      const owns = ref.startsWith("private/kyc/") && (await customerOwnsDocument(payload.userId, ref));
      if (!owns) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    /**
     * Preferred path: hand the browser a signed URL and let the CDN serve the bytes.
     *
     * `no-store` on the redirect itself is deliberate — the signed URL expires, so caching
     * the 302 would hand a later visitor a dead link.
     */
    const signed = await signedUrlFor(ref);
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 302,
        headers: { "Cache-Control": "no-store" },
      });
    }

    /**
     * Fallback: stream it. Still costs egress twice, but it is correct, and it only runs when
     * the provider cannot presign. Streamed rather than buffered — the code this replaces
     * called `arrayBuffer()` and held whole PDFs in function memory.
     */
    const streamed = await streamPrivateBlob(ref);
    if (!streamed) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }

    const filename = ref.split("/").pop() || "document";
    return new NextResponse(streamed.stream, {
      headers: {
        "Content-Type": streamed.contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        // Private to the browser that asked for it, and never to a shared cache.
        "Cache-Control": `private, max-age=${SIGNED_URL_TTL_SECONDS}`,
      },
    });
  } catch (error: unknown) {
    console.error("[documents] Failed to serve a private document:", error);
    return NextResponse.json({ message: "Failed to load the document" }, { status: 500 });
  }
}
