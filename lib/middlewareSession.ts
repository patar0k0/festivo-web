import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { parseBearerAuthorization } from "@/lib/auth/getUserFromRequest";
import { getSupabaseEnv } from "@/lib/supabaseServer";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decodes the `sub` claim from a JWT **without verifying the signature**.
 *
 * This is intentionally cheap (no network call to Supabase) and is used ONLY to
 * key rate limits per user. It is never used for authorization — the actual
 * route handlers still verify the token via `getUser(jwt)`. An attacker who
 * forges a `sub` only changes which rate-limit bucket they land in; they cannot
 * gain access, and the real auth check still rejects the request.
 *
 * Returns the `sub` only when it looks like a Supabase user UUID, else `null`.
 */
function decodeUserIdFromJwt(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const json = atob(padded);
    const claims = JSON.parse(json) as { sub?: unknown };
    const sub = typeof claims.sub === "string" ? claims.sub : null;
    return sub && UUID_RE.test(sub) ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the user id to key rate limits on, preferring a `Authorization: Bearer`
 * JWT (mobile app — cookie-less) before falling back to the cookie session (web).
 *
 * Without this, every mobile request keys on IP, so all users behind one NAT
 * (carrier-grade NAT, shared Wi‑Fi) share a single rate-limit bucket and can
 * falsely 429 each other.
 */
export async function getRateLimitUserId(request: NextRequest): Promise<string | null> {
  const bearer = parseBearerAuthorization(request.headers.get("authorization"));
  if (typeof bearer === "string") {
    const fromJwt = decodeUserIdFromJwt(bearer);
    if (fromJwt) return fromJwt;
  }
  return getSessionUserIdReadOnly(request);
}

/**
 * Reads auth user id from the session cookie without writing refreshed cookies.
 * Used before rate limiting so we can key limits per user; full `getUser()` refresh
 * still runs on the normal middleware response path.
 */
export async function getSessionUserIdReadOnly(request: NextRequest): Promise<string | null> {
  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    return null;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Intentionally no-op: avoid dropping refreshed cookies on early 429/403 responses.
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}
