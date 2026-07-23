import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import fs from "fs/promises";
import path from "path";

export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Rate limit uploads to prevent storage quota exhaustion
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    try {
      await rateLimit(ip);
    } catch {
      return NextResponse.json({ message: "Too many upload requests. Please try again later." }, { status: 429 });
    }

    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err: unknown) {
      console.error("FormData parse error in upload route:", err);
      return NextResponse.json(
        { message: "File upload failed or payload body exceeded server limit. Please use a smaller file or video URL." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    const isVideo = file.type.startsWith("video/");

    // Validate file type — allow common images and videos
    const ALLOWED_TYPES = [
      "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
      "image/jpg", "image/avif",
      "video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-matroska"
    ];

    if (!ALLOWED_TYPES.includes(file.type) && !file.type.startsWith("image/") && !isVideo) {
      return NextResponse.json(
        { message: "File type not allowed. Supported formats: Images (JPEG, PNG, WebP, GIF, SVG) and Videos (MP4, WebM, QuickTime)." },
        { status: 400 }
      );
    }

    // Validate file size — 10MB for images, 30MB for videos
    const MAX_SIZE = isVideo ? 30 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { message: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${isVideo ? "30MB" : "10MB"}.` },
        { status: 400 }
      );
    }

    // Generate a clean safe filename prefixing with timestamp to avoid name collisions
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    // 1. If Vercel Blob Token is configured, attempt upload to Vercel Blob store
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(safeName, file, { access: "public" });
        if (blob?.url) {
          return NextResponse.json({ url: blob.url });
        }
      } catch (blobError) {
        console.warn("Vercel Blob upload failed, falling back to local file storage:", blobError);
      }
    }

    // 2. Fallback: Save file locally in public/uploads for local development & self-hosted servers
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, safeName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/${safeName}` });
  } catch (error: unknown) {
    console.error("File upload failed:", error);
    return NextResponse.json(
      { message: (error as any).message || "Failed to process file upload" },
      { status: 500 }
    );
  }
}
