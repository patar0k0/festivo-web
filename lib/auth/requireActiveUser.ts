import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveUserSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Authenticated user whose `public.users.deleted_at` is null.
 * Throws `Error("Unauthorized")`, `Error("User is deleted")`, or the Supabase error from the users lookup.
 */
export async function requireActiveUserWithSupabase(): Promise<{ supabase: ActiveUserSupabase; user: User }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  if (!user) {
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

export async function requireActiveUser(): Promise<User> {
  const { user } = await requireActiveUserWithSupabase();
  return user;
}

type ErrorBody = Record<string, unknown>;

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
      return NextResponse.json(body ? body(msg) : { error: msg }, { status: 401 });
    }
    if (e.message === "User is deleted") {
      const msg = "User is deleted";
      return NextResponse.json(body ? body(msg) : { error: msg }, { status: 403 });
    }
  }
  return null;
}
