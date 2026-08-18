import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: Request, { params }: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await params;
    const { searchParams } = new URL(request.url);
    const blobUrl = searchParams.get("url");

    if (blobUrl) {
      // Validate the URL to prevent SSRF
      if (!blobUrl.startsWith("https://") || !blobUrl.includes(".blob.vercel-storage.com/")) {
        return NextResponse.json({ message: "Invalid blob URL" }, { status: 400 });
      }

      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (!blobToken) {
        return NextResponse.json({ message: "Blob token not configured" }, { status: 500 });
      }

      // Fetch the private blob using the token
      const response = await fetch(blobUrl, {
        headers: {
          Authorization: `Bearer ${blobToken}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json({ message: "Failed to fetch document from blob storage" }, { status: response.status });
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const arrayBuffer = await response.arrayBuffer();

      return new NextResponse(arrayBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    }

    // Local disk fallback
    const documentsDir = path.join(process.cwd(), "documents");
    const filePath = path.join(documentsDir, filename);

    try {
      const fileBuffer = await fs.readFile(filePath);
      let contentType = "application/octet-stream";
      if (filename.endsWith(".pdf")) contentType = "application/pdf";
      else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (filename.endsWith(".png")) contentType = "image/png";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${filename}"`,
        },
      });
    } catch (fsErr) {
      return NextResponse.json({ message: "Document not found locally" }, { status: 404 });
    }
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to load document" }, { status: 500 });
  }
}
