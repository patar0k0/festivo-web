import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabaseServer";

/** Loosely typed client (matches `@supabase/ssr` server client) so routes work with partial `Database` typings. */
export type RequestSupabaseClient = SupabaseClient;

/**
 * Parses `Authorization` for a Bearer JWT.
 * - No `Bearer` scheme → `null` (caller should use cookie session).
 * - `Bearer` present but token missing/whitespace-only → `"invalid"` (401, no cookie fallback).
 * - Otherwise the trimmed JWT string (single token, no spaces).
 */
export function parseBearerAuthorization(authorization: string | null): string | null | "invalid" {
  if (authorization == null || authorization.trim() === "") {
    return null;
  }
  const trimmed = authorization.trim();
  if (!/^Bearer\b/i.test(trimmed)) {
    return null;
  }
  const rest = trimmed.replace(/^Bearer\s*/i, "").trim();
  if (!rest) {
    return "invalid";
  }
  if (/\s/.test(rest)) {
    return "invalid";
  }
  return rest;
}

export type GetUserFromRequestResult = {
  supabase: RequestSupabaseClient;
  user: User | null;
  /** `Authorization: Bearer` with no/invalid token — must respond 401 without trying cookies. */
  bearerMalformed?: true;
};

/**
 * Resolves the Supabase user for an HTTP request.
 *
 * - If `Authorization: Bearer <jwt>` is present and non-empty: validates via `getUser(jwt)` and
 *   returns a Supabase client that sends that JWT on data requests (RLS).
 * - Otherwise: uses the existing cookie-based SSR client (`createSupabaseServerClient`).
 *
 * Does not throw for missing identity: returns `{ user: null }` when there is no session
 * and no Bearer token (cookie path). Caller maps to 401 when auth is required.
 *
 * @param req - When omitted, only the cookie-based path runs (e.g. React Server Components).
 */
export async function getUserFromRequest(req?: Request): Promise<GetUserFromRequestResult> {
  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    throw new Error("Missing Supabase env");
  }

  const authHeader = req?.headers.get("authorization") ?? null;
  const bearer = parseBearerAuthorization(authHeader);

  // Force Next.js / Vercel to bypass its built-in fetch cache for every
  // Supabase HTTP call made via this client. Without this, the App Router's
  // default fetch caching can serve stale rows even after a successful
  // mutation, which corrupted the mobile plan screen (deleted rows kept
  // re-appearing on the next GET /state until the cache expired).
  const noStoreFetch: typeof fetch = (input, init) =>
    fetch(input, { ...(init ?? {}), cache: "no-store" });

  if (bearer === "invalid") {
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    });
    return { supabase, user: null, bearerMalformed: true };
  }

  if (typeof bearer === "string") {
    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: { Authorization: `Bearer ${bearer}` },
        fetch: noStoreFetch,
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(bearer);

    if (error) {
      console.warn("[getUserFromRequest] Bearer getUser failed", error.message);
      return { supabase, user: null };
    }

    return { supabase, user: user ?? null };
  }

  const supabase = (await createSupabaseServerClient()) as RequestSupabaseClient;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.warn("[getUserFromRequest] cookie getUser failed", error.message);
    return { supabase, user: null };
  }

  return { supabase, user: user ?? null };
}
