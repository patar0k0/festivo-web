import type { SupabaseClient } from "@supabase/supabase-js";
import { hasActiveOrganizerMembership } from "@/lib/organizer/portal";

export type EditableFestivalGateResult =
  | { ok: true; organizerId: string }
  | { ok: false; status: 403 | 404; error: string };

type FestivalOwnershipRow = { organizer_id: string | null; status: string | null };

async function resolveFestivalOrganizerId(
  admin: SupabaseClient,
  festivalId: string,
): Promise<{ organizerId: string | null; status: string | null } | null> {
  const { data: festivalRow, error: festivalError } = await admin
    .from("festivals")
    .select("organizer_id,status")
    .eq("id", festivalId)
    .maybeSingle<FestivalOwnershipRow>();

  if (festivalError) {
    throw new Error(festivalError.message);
  }
  if (!festivalRow) return null;

  if (festivalRow.organizer_id) {
    return { organizerId: festivalRow.organizer_id, status: festivalRow.status };
  }

  const { data: linkRow, error: linkError } = await admin
    .from("festival_organizers")
    .select("organizer_id")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle<{ organizer_id: string | null }>();

  if (linkError) {
    throw new Error(linkError.message);
  }

  return { organizerId: linkRow?.organizer_id ?? null, status: festivalRow.status };
}

const EDITABLE_STATUSES = new Set(["verified", "published"]);

/** Gate shared by every `app/api/organizer/festivals/[id]/**` route: organizer must own the
 * festival via an active write-role membership, and the festival must already be live. */
export async function assertOrganizerCanEditPublishedFestival(
  admin: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<EditableFestivalGateResult> {
  const ownership = await resolveFestivalOrganizerId(admin, festivalId);
  if (!ownership || !ownership.organizerId) {
    return { ok: false, status: 404, error: "Фестивалът не е намерен." };
  }

  if (!ownership.status || !EDITABLE_STATUSES.has(ownership.status)) {
    return { ok: false, status: 403, error: "Можете да редактирате само одобрени фестивали." };
  }

  const allowed = await hasActiveOrganizerMembership(admin, userId, ownership.organizerId);
  if (!allowed) {
    return { ok: false, status: 403, error: "Нямате права за този фестивал." };
  }

  return { ok: true, organizerId: ownership.organizerId };
}
