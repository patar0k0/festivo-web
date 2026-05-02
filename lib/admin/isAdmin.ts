import { cache } from "react";
import { redirect } from "next/navigation";
import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { requireActiveUserWithSupabase } from "@/lib/auth/requireActiveUser";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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

function jwtRoleIsAdmin(role: unknown): boolean {
  return role === "admin" || role === "super_admin";
}

function dbRolesIsAdmin(roles: { role: string }[] | null | undefined): boolean {
  return roles?.some((r) => r.role === "admin" || r.role === "super_admin") ?? false;
}

/**
 * Resolves admin access: JWT `app_metadata.role` OR `user_roles` row (admin / super_admin).
 * When DB says staff but JWT lacks role, merges `role` into Auth `app_metadata` and redirects
 * through `/api/auth/sign-out` so the next login/session picks up the JWT claim.
 */
async function resolveAdminAccessOrRedirect(supabase: SupabaseClient, user: User): Promise<void> {
  const jwtRole = user.app_metadata?.role;
  const isJwtAdmin = jwtRoleIsAdmin(jwtRole);

  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`user_roles lookup failed: ${error.message}`);
  }

  const isDbAdmin = dbRolesIsAdmin(roles);

  if (isDbAdmin && !isJwtAdmin) {
    try {
      const admin = createSupabaseAdmin();
      const { data: authData, error: getErr } = await admin.auth.admin.getUserById(user.id);
      if (getErr || !authData?.user) {
        throw getErr ?? new Error("getUserById returned no user");
      }
      const prev = { ...(authData.user.app_metadata ?? {}) } as Record<string, unknown>;
      const newRole = (roles ?? []).some((r) => r.role === "super_admin") ? "super_admin" : "admin";
      const { error: upErr } = await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...prev, role: newRole },
      });
      if (upErr) {
        throw upErr;
      }
      redirect(`/api/auth/sign-out?next=${encodeURIComponent("/login?next=/admin")}`);
    } catch (e) {
      console.error("[resolveAdminAccessOrRedirect] JWT role sync failed", e);
    }
  }

  if (!isJwtAdmin && !isDbAdmin) {
    redirect("/");
  }
}

export async function hasAdminRole(client: SupabaseClient, userId: string, user?: User) {
  if (user != null && jwtRoleIsAdmin(user.app_metadata?.role)) {
    return true;
  }

  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);

  if (error) {
    throw new Error(`user_roles lookup failed: ${error.message}`);
  }

  return dbRolesIsAdmin(data);
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

  await resolveAdminAccessOrRedirect(supabase, user);

  return { supabase, client: supabase, user, isAdmin: true };
}

/** Same as `requireAdminAuthContext`, at most once per React request tree. */
export const getAdminAuthContext = cache(requireAdminAuthContext);

export async function getAdminContext(): Promise<AdminAuthContext | null> {
  try {
    const { supabase, user } = await requireActiveUserWithSupabase();
    const isAdmin = await hasAdminRole(supabase, user.id, user);
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
    const isAdmin = await hasAdminRole(supabase, user.id, user);
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
    await resolveAdminAccessOrRedirect(supabase, user);
    return {
      userId: user.id,
      email: user.email ?? null,
      isAdmin: true,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "Unauthorized") {
      redirect("/login?next=/admin");
    }
    if (e instanceof Error && e.message === "User is deleted") {
      redirect("/account-deleted");
    }
    throw e;
  }
}
