// app/admin/api/research-smart/image-proxy/route.ts
//
// Admin-gated server-side image proxy used by the smart research panel.
//
// Why: thumbnails surfaced in `hero_image_candidates` (gstatic, festival sites,
// SerpAPI proxy) often refuse to render directly in the admin's browser because:
//   - Hotlink protection rejecting Referer: festivo.bg
//   - CORS / cross-origin restrictions
//   - SerpAPI proxy thumbnails with short TTL or auth quirks
//
// By streaming the image through our domain with appropriate UA/Referer, the
// admin always sees the preview and can pick a real cover before submitting.
// The original URL is still what's submitted to direct-create (server rehosts
// from the highest-quality original).
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB hard cap

function isFacebookHost(host: string): boolean {
  return host === "facebook.com" || host.endsWith(".facebook.com");
}

function isInstagramHost(host: string): boolean {
  return host === "instagram.com" || host.endsWith(".instagram.com");
}

function pickUserAgent(host: string): string {
  if (isFacebookHost(host) || isInstagramHost(host)) {
    return "Mozilla/5.0 (compatible; festivo-bot/3.0; +https://festivo.bg/bot) facebookexternalhit/1.1";
  }
  return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target || target.length > 2000) {
    return NextResponse.json({ error: "url query param required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs allowed" }, { status: 400 });
  }
  const host = parsed.hostname.toLowerCase();

  // SSRF guards — block private/loopback hosts. Conservative checks; admins are
  // already trusted but we don't want this endpoint to ever be a portscanning
  // primitive if an auth bug is introduced later.
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host) ||
    /^(?:fc|fd|fe80:)/i.test(host)
  ) {
    return NextResponse.json({ error: "Private host blocked" }, { status: 400 });
  }

  let upstream: Response | null;
  try {
    upstream = await fetch(parsed.toString(), {
      method: "GET",
      headers: {
        "User-Agent": pickUserAgent(host),
        Accept: "image/*,*/*;q=0.8",
        // Some sites (e.g. eventbg.com, festival vendor sites) check Referer for
        // hotlink protection. Send no Referer — equivalent to a direct visit.
        Referer: "",
        "Accept-Language": "bg,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream fetch failed" },
      { status: 502 },
    );
  }

  if (!upstream || !upstream.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream?.status ?? "no response"}` },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  // Accept image/* + a couple of CDN-quirky types (some CDNs return
  // application/octet-stream for valid jpegs)
  const okType =
    contentType.startsWith("image/") ||
    contentType.startsWith("application/octet-stream") ||
    contentType === "";
  if (!okType) {
    return NextResponse.json(
      { error: `Upstream returned non-image content-type: ${contentType}` },
      { status: 415 },
    );
  }

  const contentLengthHeader = upstream.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
  }

  // Buffer fully so we can enforce the size cap (streaming would let an
  // adversarial upstream blow past it).
  let buffer: ArrayBuffer;
  try {
    buffer = await upstream.arrayBuffer();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream read failed" },
      { status: 502 },
    );
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  // Normalise content-type for octet-stream / empty: default to image/jpeg
  // (browsers sniff anyway, this is mostly a hint).
  const outType = contentType.startsWith("image/") ? contentType : "image/jpeg";

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": outType,
      "Content-Length": String(buffer.byteLength),
      // Admin-only preview — short browser cache, no CDN cache.
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      // Prevent the proxied image from being embedded off-site (defence in depth).
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
