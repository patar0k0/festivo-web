import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/admin/appRoles";
import { isStaffAdminRole } from "@/lib/admin/appRoles";
import { fetchUserDeletedAtMap } from "@/lib/admin/adminUserAccount";
import {
  effectiveBannedUntilForDisplay,
  isUserBannedFromEitherSource,
} from "@/lib/admin/userBanEffective";

export const ADMIN_USERS_LIST_CHUNK = 150;

/** A single organizer a user is linked to (active or pending), for the admin list. */
export type AdminUserOrganizerLink = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  role: string;
};

export type AdminUserListRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  /** Display: DB mirror when set, else Auth. */
  banned_until: string | null;
  /** True if either DB or Auth indicates an active ban. */
  banned_active: boolean;
  provider: string;
  is_admin: boolean;
  app_role: AppRole;
  deleted_at: string | null;
  full_name: string | null;
  organizer_count: number;
  pending_claim_count: number;
  organizer_links: AdminUserOrganizerLink[];
};

export function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

export function emailLocalPart(email: string | null | undefined): string {
  if (!email) return "—";
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export function providerKey(user: User): string {
  const raw = user.app_metadata?.provider;
  if (raw == null || raw === "") return "email";
  return String(raw).toLowerCase();
}

export type AdminUserListEnrich = {
  is_admin: boolean;
  app_role: AppRole;
  deleted_at: string | null;
  banned_until_db: string | null;
  organizer_count: number;
  pending_claim_count: number;
  organizer_links: AdminUserOrganizerLink[];
};

export function emptyAdminUserListEnrich(): AdminUserListEnrich {
  return {
    is_admin: false,
    app_role: "user",
    deleted_at: null,
    banned_until_db: null,
    organizer_count: 0,
    pending_claim_count: 0,
    organizer_links: [],
  };
}

/** Normalize a PostgREST embed that may arrive as an object, an array, or null. */
function firstEmbedded<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function enrichUsersForAdminList(
  adminClient: SupabaseClient,
  userIds: string[],
): Promise<Map<string, AdminUserListEnrich>> {
  const map = new Map<string, AdminUserListEnrich>();
  for (const id of userIds) {
    map.set(id, emptyAdminUserListEnrich());
  }

  const chunks = chunkIds(userIds, ADMIN_USERS_LIST_CHUNK);

  for (const ids of chunks) {
    if (ids.length === 0) continue;

    const deletedMap = await fetchUserDeletedAtMap(adminClient, ids);
    for (const id of ids) {
      const cur = map.get(id);
      if (cur) cur.deleted_at = deletedMap.get(id) ?? null;
    }

    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("user_id,role")
      .in("user_id", ids);

    if (rolesError) {
      throw new Error(`user_roles: ${rolesError.message}`);
    }

    for (const row of roles ?? []) {
      const cur = map.get(row.user_id as string);
      if (!cur) continue;
      const r = String(row.role ?? "");
      cur.app_role = r === "user" || r === "organizer" || r === "admin" || r === "super_admin" ? r : "user";
      cur.is_admin = isStaffAdminRole(cur.app_role);
    }

    const { data: members, error: membersError } = await adminClient
      .from("organizer_members")
      .select("user_id,status,role,organizer:organizers(id,name,slug)")
      .in("user_id", ids);

    if (membersError) {
      throw new Error(`organizer_members: ${membersError.message}`);
    }

    for (const row of members ?? []) {
      const cur = map.get(row.user_id as string);
      if (!cur) continue;
      const status = String(row.status ?? "");
      if (status === "active") cur.organizer_count += 1;
      if (status === "pending") cur.pending_claim_count += 1;

      const org = firstEmbedded(
        (row as { organizer?: { id?: string; name?: string; slug?: string | null } | { id?: string; name?: string; slug?: string | null }[] | null }).organizer,
      );
      if (org?.id) {
        cur.organizer_links.push({
          id: String(org.id),
          name: typeof org.name === "string" && org.name.trim() ? org.name.trim() : "Без име",
          slug: typeof org.slug === "string" && org.slug.trim() ? org.slug.trim() : null,
          status,
          role: String(row.role ?? ""),
        });
      }
    }

    const { data: banRows, error: banErr } = await adminClient
      .from("users")
      .select("id, banned_until")
      .in("id", ids);

    if (banErr) {
      throw new Error(`users banned_until: ${banErr.message}`);
    }

    for (const row of banRows ?? []) {
      const cur = map.get(row.id as string);
      if (cur) {
        cur.banned_until_db = (row as { banned_until?: string | null }).banned_until ?? null;
      }
    }
  }

  return map;
}

function displayNameFromUser(user: User): string | null {
  const meta = user.user_metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const fn = (meta as Record<string, unknown>)["full_name"];
    if (typeof fn === "string" && fn.trim()) return fn.trim();
  }
  return null;
}

export function userToAdminListRow(user: User, enrich: AdminUserListEnrich): AdminUserListRow {
  const authBan = user.banned_until ?? null;
  const dbBan = enrich.banned_until_db;
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: effectiveBannedUntilForDisplay(dbBan, authBan),
    banned_active: isUserBannedFromEitherSource(dbBan, authBan),
    provider: providerKey(user),
    is_admin: enrich.is_admin,
    app_role: enrich.app_role,
    deleted_at: enrich.deleted_at,
    full_name: displayNameFromUser(user),
    organizer_count: enrich.organizer_count,
    pending_claim_count: enrich.pending_claim_count,
    organizer_links: sortOrganizerLinks(enrich.organizer_links),
  };
}

/** Active links first, then pending, then the rest; alphabetical within each group. */
function sortOrganizerLinks(links: AdminUserOrganizerLink[]): AdminUserOrganizerLink[] {
  const rank = (status: string) => (status === "active" ? 0 : status === "pending" ? 1 : 2);
  return [...links].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return a.name.localeCompare(b.name, "bg");
  });
}

export function emailMatchesQuery(email: string | null | undefined, q: string): boolean {
  if (!email) return false;
  return email.toLowerCase().includes(q.trim().toLowerCase());
}

export function nameMatchesQuery(user: User, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  const n = displayNameFromUser(user);
  return Boolean(n && n.toLowerCase().includes(needle));
}

const STALE_LOGIN_MS = 90 * 24 * 60 * 60 * 1000;

export function userMatchesLastLoginFilter(
  user: User,
  lastLogin: "recent" | "stale" | "" | "all",
): boolean {
  return lastSignInMatchesLastLoginFilter(user.last_sign_in_at ?? null, lastLogin);
}

export function lastSignInMatchesLastLoginFilter(
  lastSignInAt: string | null,
  lastLogin: "recent" | "stale" | "" | "all",
): boolean {
  if (lastLogin !== "recent" && lastLogin !== "stale") return true;
  if (!lastSignInAt) {
    return lastLogin === "stale";
  }
  const t = new Date(lastSignInAt).getTime();
  if (!Number.isFinite(t)) {
    return lastLogin === "stale";
  }
  const recent = Date.now() - t < STALE_LOGIN_MS;
  return lastLogin === "recent" ? recent : !recent;
}
