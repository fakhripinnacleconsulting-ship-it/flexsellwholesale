import mongoose, { Schema } from "mongoose";

/**
 * A private document, stored as bytes in MongoDB.
 *
 * Private documents do **not** go to blob storage, for two reasons that both came out of a
 * live failure:
 *
 *  1. **A public Vercel Blob store cannot hold private objects at all** — `put` with
 *     `access: "private"` is refused outright ("Cannot use private access on a public
 *     store"), so every KYC and payment-proof upload failed regardless of the token.
 *  2. Even where private blobs are available, a blob URL that leaks is readable by whoever
 *     holds it. These documents are Aadhaar, PAN and cancelled cheques — there should be no
 *     URL that reads them, only an authenticated route that checks ownership first.
 *
 * Storing them here means there is no public URL in existence, no egress bill for viewing
 * one, and uploads keep working when blob storage is unavailable.
 *
 * **Size.** The upload rules cap private kinds at 10 MB and images are compressed to ~1 MB in
 * the browser first, so a document sits comfortably inside MongoDB's 16 MB BSON limit. GridFS
 * would be the answer if that ever stopped being true; it is deliberately not used now,
 * because a second storage mechanism is a second thing to get wrong.
 */

const StoredDocumentSchema = new Schema(
  {
    /**
     * The stored reference, and the path the serving route resolves.
     *
     * Carries a UUID, so it is unguessable even before the ownership check — the same
     * property the blob pathnames had.
     */
    _id: { type: String, required: true },

    /** Raw bytes. Mongoose maps Buffer to BSON binary. */
    data: { type: Buffer, required: true },

    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String },

    /**
     * Which upload kind produced this — `kyc`, `proof` or `dropship`.
     *
     * Read by the serving route: a customer may see their own KYC, but proofs and dropship
     * documents are internal records *about* a customer rather than documents belonging to
     * them, and only staff may open those.
     */
    kind: { type: String, required: true, enum: ["kyc", "proof", "dropship"] },

    /**
     * Who uploaded it. Not the ownership check on its own — that reads the referencing
     * record — but it is what makes an orphan attributable.
     */
    uploadedBy: {
      userId: { type: String },
      role: { type: String },
    },
  },
  { timestamps: true }
);

// Cleanup and auditing both scan by kind and age; nothing else queries this collection.
StoredDocumentSchema.index({ kind: 1, createdAt: -1 });
StoredDocumentSchema.index({ "uploadedBy.userId": 1 });

if (mongoose.models.StoredDocument) {
  mongoose.deleteModel("StoredDocument");
}

export default mongoose.model("StoredDocument", StoredDocumentSchema);
