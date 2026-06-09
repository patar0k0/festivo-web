import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight OAuth callback for the one-time TikTok account connect.
// TikTok redirects here with ?code=... after consent; we just display the code
// so it can be pasted into `scripts/connect_social_account.mjs tiktok <code>`.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  if (error) {
    return new NextResponse(`TikTok OAuth error: ${error}\n${errorDesc ?? ""}`, {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (!code) {
    return new NextResponse("Missing ?code in callback URL.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(
    `TikTok authorization code:\n\n${code}\n\n` +
      `Next: run on the server/local:\n` +
      `  node scripts/connect_social_account.mjs tiktok "${code}"\n\n` +
      `(The code expires quickly — use it within a minute.)`,
    { headers: { "content-type": "text/plain; charset=utf-8" } }
  );
}
