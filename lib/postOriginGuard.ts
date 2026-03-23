import { NextResponse, type NextRequest } from "next/server";
import { canBypassJobsRateLimit } from "@/lib/rateLimit";

function addHost(set: Set<string>, raw: string | undefined) {
  if (!raw?.trim()) return;
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    set.add(u.host);
  } catch {
    if (/^[a-zA-Z0-9.-]+(?::\d+)?$/.test(trimmed)) {
      set.add(trimmed.toLowerCase());
    }
  }
}

/**
 * Hostnames allowed to initiate browser POSTs to /api/* (CSRF-ish protection).
 * Built from NEXT_PUBLIC_SITE_URL, VERCEL_URL (preview), optional CSRF_ALLOWED_HOSTS.
 */
export function collectAllowedApiPostHosts(): Set<string> {
  const hosts = new Set<string>();

  addHost(hosts, process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_URL) {
    addHost(hosts, `https://${process.env.VERCEL_URL}`);
  }
  for (const part of (process.env.CSRF_ALLOWED_HOSTS ?? "").split(",")) {
    addHost(hosts, part.trim());
  }

  if (hosts.has("festivo.bg")) hosts.add("www.festivo.bg");
  if (hosts.has("www.festivo.bg")) hosts.add("festivo.bg");

  if (process.env.NODE_ENV === "development") {
    hosts.add("localhost:3000");
    hosts.add("127.0.0.1:3000");
    hosts.add("localhost");
    hosts.add("127.0.0.1");
  }

  return hosts;
}

function hostFromUrl(urlStr: string): string | null {
  try {
    return new URL(urlStr).host;
  } catch {
    return null;
  }
}

/**
 * Rejects cross-site POSTs when Origin/Referer is present and not in the allowlist.
 * Missing Origin+Referer: allowed (server-side tools, curl, some clients).
 * If no allowlist is configured, fail-open (do not block).
 */
export function verifyApiPostOrigin(request: NextRequest): NextResponse | null {
  if (request.method !== "POST") return null;

  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/api/")) return null;

  if (canBypassJobsRateLimit(request)) {
    return null;
  }

  const allowed = collectAllowedApiPostHosts();
  if (allowed.size === 0) {
    return null;
  }

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  const isAllowed = (urlStr: string) => {
    const host = hostFromUrl(urlStr);
    return Boolean(host && allowed.has(host));
  };

  if (origin && origin !== "null") {
    if (!isAllowed(origin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  if (referer) {
    if (!isAllowed(referer)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
  }

  return null;
}
