import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { requireAuth } from "@/lib/authGuard";
import { rateLimit } from "@/lib/rateLimit";
import { signedUrlFor, streamPrivateBlob, readStoredDocument, SIGNED_URL_TTL_SECONDS } from "@/lib/storage";
import { verifyDocumentPreviewToken } from "@/lib/documentAccess";

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
    const { pathname: segments } = await params;
    const ref = segments.map(decodeURIComponent).join("/");

    /**
     * A signed, single-document pass stands in for a session.
     *
     * Registration and public order creation attach documents *before* an account exists, so
     * the person who just uploaded a file has no session to prove it with. The upload response
     * hands them a token naming that one path; it is signed, short-lived, and opens nothing
     * else — see `lib/documentAccess.ts`.
     */
    const previewToken = new URL(request.url).searchParams.get("t");
    const hasPreviewPass = verifyDocumentPreviewToken(previewToken, ref);

    const auth = hasPreviewPass ? { payload: undefined, error: undefined } : await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload;

    try {
      await rateLimit(
        payload?.userId ||
          `doc_${(request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim()}`,
        "general"
      );
    } catch {
      return NextResponse.json({ message: "Too many requests." }, { status: 429 });
    }

    // Reject traversal outright rather than normalising it. A path that tries to escape is
    // not a path to repair.
    if (ref.includes("..") || ref.startsWith("/")) {
      return NextResponse.json({ message: "Invalid document path" }, { status: 400 });
    }

    if (!ALLOWED_PREFIXES.some((prefix) => ref.startsWith(prefix))) {
      return NextResponse.json({ message: "Invalid document path" }, { status: 400 });
    }

    const isStaff = payload?.role === "admin" || payload?.role === "manager";

    // The pass already named this exact document, so there is nothing further to check —
    // it cannot be pointed at anything else.
    if (!hasPreviewPass && !isStaff) {
      // A customer may read their own KYC and nothing else. Proofs and dropship documents are
      // internal records about a customer, not documents belonging to them.
      await dbConnect();
      const owns = ref.startsWith("private/kyc/") && (await customerOwnsDocument(payload!.userId, ref));
      if (!owns) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    /**
     * The usual case: the document lives in the database, so serve it from here.
     *
     * Checked before any signed-URL path because that is where private documents are
     * written — see `PRIVATE_PROVIDERS`. There is no URL that reads this document without
     * passing the ownership check above, which is the entire reason it is stored this way.
     */
    const stored = await readStoredDocument(ref);
    if (stored) {
      return new NextResponse(new Uint8Array(stored.data), {
        headers: {
          "Content-Type": stored.contentType,
          "Content-Disposition": `inline; filename="${ref.split("/").pop() || "document"}"`,
          // Private to the one browser that asked, never a shared cache.
          "Cache-Control": `private, max-age=${SIGNED_URL_TTL_SECONDS}`,
        },
      });
    }

    /**
     * Otherwise the document predates database storage and lives with a blob provider.
     *
     * Hand the browser a short-lived signed URL where the provider can mint one, so the
     * bytes travel from the CDN rather than through this function. `no-store` on the
     * redirect is deliberate — the signed URL expires, and a cached 302 would hand a later
     * visitor a dead link.
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
