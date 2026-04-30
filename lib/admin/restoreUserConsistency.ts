import type { SupabaseClient } from "@supabase/supabase-js";

const ORG_MEMBER_ROLES = new Set(["owner", "admin", "editor", "viewer"]);
const ORG_MEMBER_STATUSES = new Set(["pending", "active", "revoked"]);

/**
 * Blocks restore when organizer membership rows reference missing organizers or invalid enums.
 */
export async function assertRestorableOrganizerMemberships(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data: rows, error } = await admin
    .from("organizer_members")
    .select("id, organizer_id, role, status")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`organizer_members: ${error.message}`);
  }

  for (const row of rows ?? []) {
    const role = String(row.role ?? "");
    const status = String(row.status ?? "");
    if (!ORG_MEMBER_ROLES.has(role)) {
      throw new Error(
        `Невалидна роля в членство (${role}). Поправете данните преди възстановяване.`,
      );
    }
    if (!ORG_MEMBER_STATUSES.has(status)) {
      throw new Error(
        `Невалиден статус в членство (${status}). Поправете данните преди възстановяване.`,
      );
    }
  }

  const orgIds = [...new Set((rows ?? []).map((r) => r.organizer_id as string))];
  if (orgIds.length === 0) return;

  const { data: orgs, error: orgErr } = await admin.from("organizers").select("id").in("id", orgIds);

  if (orgErr) {
    throw new Error(`organizers: ${orgErr.message}`);
  }

  const found = new Set((orgs ?? []).map((o) => o.id as string));
  for (const id of orgIds) {
    if (!found.has(id)) {
      throw new Error(
        "Членство сочи към липсващ организатор. Поправете връзките преди възстановяване.",
      );
    }
  }
}

export function isActiveBanTs(bannedUntil: string | null | undefined): boolean {
  if (bannedUntil == null || bannedUntil === "") return false;
  return new Date(bannedUntil) > new Date();
}
