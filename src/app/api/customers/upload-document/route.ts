import { POST as uploadHandler } from "@/app/api/upload/route";

export const maxDuration = 60;

/**
 * Backwards-compatible forwarder.
 *
 * This route used to hold its own upload implementation, and it was the source of the
 * bandwidth incident: it stored `/api/customers/document/<name>?url=<blobUrl>` in Mongo, so
 * every view of a KYC document or payment proof was proxied through a serverless function
 * that fetched the blob and re-streamed it — billed egress twice, cached never.
 *
 * The implementation now lives in `/api/upload`. This stays so a browser still running the
 * previous deploy keeps working through a rollout rather than failing mid-form; it defaults
 * the `kind` to `kyc`, which is what every historic caller of this path was sending.
 *
 * Remove once no client has posted here for a full deploy cycle.
 */
export async function POST(request: Request) {
  const formData = await request.formData();

  if (!formData.get("kind")) {
    formData.set("kind", "kyc");
  }

  return uploadHandler(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: formData,
    })
  );
}
