import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/rateLimit";
import fs from "fs/promises";
import path from "path";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    try {
      await rateLimit(ip);
    } catch {
      return NextResponse.json({ message: "Too many upload requests. Please try again later." }, { status: 429 });
    }


    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err: unknown) {
      console.error("FormData parse error in upload-document route:", err);
      return NextResponse.json(
        { message: "File upload failed or payload body exceeded server limit." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    const ALLOWED_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png"
    ];

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: "File type not allowed. Only PDF, JPG, JPEG, and PNG files are allowed for KYC documents." },
        { status: 400 }
      );
    }

    const MAX_SIZE = 1 * 1024 * 1024; // 1 MB limit
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { message: `File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum allowed size for documents is 1 MB.` },
        { status: 400 }
      );
    }

    const safeName = `kyc-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // 1. Try Vercel Blob
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (blobToken) {
      try {
        const blob = await put(safeName, file, { access: "public", token: blobToken });
        if (blob?.url) {
          return NextResponse.json({ url: blob.url });
        }
      } catch (blobError: any) {
        console.warn("Vercel Blob upload failed for document, falling back:", blobError?.message || blobError);
      }
    }

    // 2. Local disk fallback
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    try {
      const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, safeName);
      await fs.writeFile(filePath, buffer);

      return NextResponse.json({ url: `/uploads/documents/${safeName}` });
    } catch (fsError: any) {
      console.warn("Local disk write failed for document:", fsError);

      // Base64 Data URL fallback
      const base64Data = buffer.toString("base64");
      const mimeType = file.type || "application/pdf";
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      return NextResponse.json({ url: dataUrl });
    }
  } catch (error: unknown) {
    console.error("Document upload failed:", error);
    return NextResponse.json(
      { message: (error as any).message || "Failed to process document upload" },
      { status: 500 }
    );
  }
}
