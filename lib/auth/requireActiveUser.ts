import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserFromRequest, type RequestSupabaseClient } from "@/lib/auth/getUserFromRequest";

export type ActiveUserSupabase = RequestSupabaseClient;

/**
 * Authenticated user whose `public.users.deleted_at` is null.
 * Uses `Authorization: Bearer` when present; otherwise cookie session (`createSupabaseServerClient`).
 *
 * Throws `Error("Unauthorized")`, `Error("User is deleted")`, or the Supabase error from the users lookup.
 *
 * @param request - Pass the incoming `Request` from Route Handlers so mobile Bearer tokens work.
 *   Omit in Server Components (cookies only).
 */
export async function requireActiveUserWithSupabase(
  request?: Request,
): Promise<{ supabase: ActiveUserSupabase; user: User }> {
  const { supabase, user, bearerMalformed } = await getUserFromRequest(request);

  if (bearerMalformed || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.from("users").select("deleted_at").eq("id", user.id).maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.deleted_at) {
    throw new Error("User is deleted");
  }

  return { supabase, user };
}

export async function requireActiveUser(request?: Request): Promise<User> {
  const { user } = await requireActiveUserWithSupabase(request);
  return user;
}

type ErrorBody = Record<string, unknown>;

const UNAUTHORIZED_JSON = { error: "Unauthorized" } as const;

/**
 * Maps failures from `requireActiveUser*` to JSON responses. Returns null for non-auth failures (e.g. PostgREST errors).
 */
export function nextResponseForRequireActiveUserError(
  e: unknown,
  body?: (message: string) => ErrorBody,
): NextResponse | null {
  if (e instanceof Error) {
    if (e.message === "Unauthorized") {
      const msg = "Unauthorized";
      return NextResponse.json(body ? body(msg) : UNAUTHORIZED_JSON, { status: 401 });
    }
    if (e.message === "User is deleted") {
      const msg = "User is deleted";
      return NextResponse.json(body ? body(msg) : { error: msg }, { status: 403 });
    }
  }
  return null;
}
