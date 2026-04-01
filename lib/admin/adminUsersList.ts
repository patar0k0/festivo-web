import type { SupabaseClient, User } from "@supabase/supabase-js";

export const ADMIN_USERS_LIST_CHUNK = 150;

export type AdminUserListRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  provider: string;
  is_admin: boolean;
  organizer_count: number;
  pending_claim_count: number;
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

export async function enrichUsersForAdminList(
  adminClient: SupabaseClient,
  userIds: string[],
): Promise<Map<string, { is_admin: boolean; organizer_count: number; pending_claim_count: number }>> {
  const map = new Map<string, { is_admin: boolean; organizer_count: number; pending_claim_count: number }>();
  for (const id of userIds) {
    map.set(id, { is_admin: false, organizer_count: 0, pending_claim_count: 0 });
  }

  const chunks = chunkIds(userIds, ADMIN_USERS_LIST_CHUNK);

  for (const ids of chunks) {
    if (ids.length === 0) continue;

    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("user_id,role")
      .eq("role", "admin")
      .in("user_id", ids);

    if (rolesError) {
      throw new Error(`user_roles: ${rolesError.message}`);
    }

    for (const row of roles ?? []) {
      const cur = map.get(row.user_id);
      if (cur) cur.is_admin = true;
    }

    const { data: members, error: membersError } = await adminClient
      .from("organizer_members")
      .select("user_id,status")
      .in("user_id", ids);

    if (membersError) {
      throw new Error(`organizer_members: ${membersError.message}`);
    }

    for (const row of members ?? []) {
      const cur = map.get(row.user_id);
      if (!cur) continue;
      if (row.status === "active") cur.organizer_count += 1;
      if (row.status === "pending") cur.pending_claim_count += 1;
    }
  }

  return map;
}

export function userToAdminListRow(user: User, enrich: { is_admin: boolean; organizer_count: number; pending_claim_count: number }): AdminUserListRow {
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: user.banned_until ?? null,
    provider: providerKey(user),
    is_admin: enrich.is_admin,
    organizer_count: enrich.organizer_count,
    pending_claim_count: enrich.pending_claim_count,
  };
}

export function emailMatchesQuery(email: string | null | undefined, q: string): boolean {
  if (!email) return false;
  return email.toLowerCase().includes(q.trim().toLowerCase());
}
