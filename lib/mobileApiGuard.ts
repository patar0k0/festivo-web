import { NextResponse, type NextRequest } from "next/server";

/**
 * Origin guard for `/api/mobile/*` endpoints.
 *
 * Threat model:
 *   - Native React Native HTTP clients do NOT send an `Origin` header → we
 *     allow these by default (this is how the production mobile app calls us).
 *   - Browsers ALWAYS send `Origin` for cross-origin fetch → we 403 unless
 *     the origin is in `MOBILE_API_ALLOWED_ORIGINS` (intended for dev only,
 *     e.g. Expo web preview at http://localhost:19006).
 *   - This blocks third-party websites and stops casual scraping via fetch().
 *     It does NOT block determined attackers using non-browser clients.
 *
 * Preflight (`OPTIONS`):
 *   - If Origin is in allowlist → 204 with restrictive CORS headers.
 *   - Otherwise → 403.
 *
 * Non-preflight:
 *   - If Origin present and not in allowlist → 403.
 *   - If Origin missing → allowed (native app traffic).
 */

const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS = "authorization, content-type, x-festivo-app-version, x-festivo-client";
const PREFLIGHT_MAX_AGE_SECONDS = 600;

let cachedAllowlist: Set<string> | null = null;

function buildAllowlist(): Set<string> {
  const raw = process.env.MOBILE_API_ALLOWED_ORIGINS ?? "";
  const set = new Set<string>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // Normalize: drop trailing slash, lowercase scheme+host.
    try {
      const u = new URL(trimmed);
      set.add(`${u.protocol}//${u.host}`.toLowerCase());
    } catch {
      // Bare value — accept as-is, lowercased.
      set.add(trimmed.toLowerCase());
    }
  }
  return set;
}

function getAllowlist(): Set<string> {
  if (cachedAllowlist) return cachedAllowlist;
  cachedAllowlist = buildAllowlist();
  return cachedAllowlist;
}

/** Reset module cache. Test-only. */
export function _resetMobileApiAllowlistForTests(): void {
  cachedAllowlist = null;
}

function isAllowedOrigin(origin: string): boolean {
  return getAllowlist().has(origin.toLowerCase());
}

function withCorsHeaders(response: NextResponse, origin: string): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Vary", "Origin");
  response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
  response.headers.set("Access-Control-Max-Age", String(PREFLIGHT_MAX_AGE_SECONDS));
  // Mobile API uses Bearer tokens; cookies are NOT used and NOT permitted.
  response.headers.set("Access-Control-Allow-Credentials", "false");
  return response;
}

/**
 * Returns a response to short-circuit the request when not allowed, or attaches
 * CORS headers to a preflight 204, or `null` to let the request continue.
 *
 * Must be called from middleware BEFORE any auth/rate-limit work.
 */
export function guardMobileApiRequest(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/api/mobile/")) return null;

  const origin = request.headers.get("origin");
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") {
    if (!origin) {
      // Preflight without Origin makes no sense; reject.
      return new NextResponse(null, { status: 400 });
    }
    if (!isAllowedOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    const preflight = new NextResponse(null, { status: 204 });
    return withCorsHeaders(preflight, origin);
  }

  if (origin && !isAllowedOrigin(origin)) {
    // Cross-origin browser fetch from a non-allowlisted site.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Origin missing (native) OR Origin in allowlist → continue.
  // We don't attach CORS headers to the eventual response here; that's only
  // required when an Origin is present. Allowed-origin responses get headers
  // applied by the route handlers if/when we need them. For native requests,
  // CORS headers are irrelevant.
  return null;
}
