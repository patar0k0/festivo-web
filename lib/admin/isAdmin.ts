import { cache } from "react";
import { redirect } from "next/navigation";
import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { requireActiveUserWithSupabase } from "@/lib/auth/requireActiveUser";

export type AdminSession = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

export type AdminAuthContext = {
  supabase: SupabaseClient;
  client: SupabaseClient;
  user: User;
  isAdmin: true;
};

export async function hasAdminRole(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();

  if (error) {
    throw new Error(`user_roles lookup failed: ${error.message}`);
  }

  return Boolean(data);
}

/**
 * Active (non-deleted) user with admin or super_admin. Redirects if unauthenticated,
 * deleted, or lacking admin role. Deduplicated per request when wrapped with `cache`.
 */
export async function requireAdminAuthContext(): Promise<AdminAuthContext> {
  let supabase;
  let user;
  try {
    ({ supabase, user } = await requireActiveUserWithSupabase());
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      redirect("/login?next=/admin");
    }
    if (e instanceof Error && e.message === "User is deleted") {
      redirect("/account-deleted");
    }
    throw e;
  }

  if (!(await hasAdminRole(supabase, user.id))) {
    redirect("/");
  }

  return { supabase, client: supabase, user, isAdmin: true };
}

/** Same as `requireAdminAuthContext`, at most once per React request tree. */
export const getAdminAuthContext = cache(requireAdminAuthContext);

export async function getAdminContext(): Promise<AdminAuthContext | null> {
  try {
    const { supabase, user } = await requireActiveUserWithSupabase();
    const isAdmin = await hasAdminRole(supabase, user.id);
    if (!isAdmin) {
      return null;
    }
    return { supabase, client: supabase, user, isAdmin: true };
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "User is deleted")) {
      return null;
    }
    throw e;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const { supabase, user } = await requireActiveUserWithSupabase();
    const isAdmin = await hasAdminRole(supabase, user.id);
    return {
      userId: user.id,
      email: user.email ?? null,
      isAdmin,
    };
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "User is deleted")) {
      return null;
    }
    throw e;
  }
}

export async function requireAdmin() {
  try {
    const { supabase, user } = await requireActiveUserWithSupabase();
    const isAdmin = await hasAdminRole(supabase, user.id);
    if (!isAdmin) {
      redirect("/");
    }
    return {
      userId: user.id,
      email: user.email ?? null,
      isAdmin: true,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      redirect("/login");
    }
    if (e instanceof Error && e.message === "User is deleted") {
      redirect("/account-deleted");
    }
    throw e;
  }
}
