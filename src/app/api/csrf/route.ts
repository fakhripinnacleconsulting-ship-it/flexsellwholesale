import { NextResponse } from "next/server";
import { generateCsrfToken } from "@/lib/csrf";

export async function GET() {
  const token = generateCsrfToken();
  const response = NextResponse.json({ csrfToken: token });
  response.cookies.set("csrf_token", token, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
