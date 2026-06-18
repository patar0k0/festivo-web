import type { SupabaseClient } from "@supabase/supabase-js";

export type FestivalAccessRole = "owner" | "co_host" | null;

/**
 * Връща ролята на user-а върху даден фестивал, изчислена през organizer_members
 * (active членства, без значение от portal ролята) и festival_organizers.
 *
 * Връща 'owner' ако user-ът е свързан с organizer, който е owner на festival-а;
 * 'co_host' ако само е свързан с co_host organizer на festival-а;
 * null ако няма връзка.
 *
 * Admin bypass се прави в route handler-ите (isAdmin check), не тук.
 *
 * Изисква supabase client с достъп до organizer_members и festival_organizers
 * (typically service-role / portal admin client).
 */
export async function getUserFestivalRole(
  admin: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<FestivalAccessRole> {
  if (!userId || !festivalId) return null;

  const { data: memberships, error: mErr } = await admin
    .from("organizer_members")
    .select("organizer_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (mErr) {
    throw new Error(`organizer_members lookup failed: ${mErr.message}`);
  }

  const organizerIds = Array.from(
    new Set((memberships ?? []).map((m) => m.organizer_id).filter(Boolean)),
  );
  if (organizerIds.length === 0) return null;

  const { data: foRows, error: foErr } = await admin
    .from("festival_organizers")
    .select("organizer_id, role")
    .eq("festival_id", festivalId)
    .in("organizer_id", organizerIds);

  if (foErr) {
    throw new Error(`festival_organizers lookup failed: ${foErr.message}`);
  }

  if (!foRows || foRows.length === 0) return null;

  if (foRows.some((r) => r.role === "owner")) return "owner";
  return "co_host";
}

/** Hard 403 ако ролята не е owner. */
export async function assertOwnerOrThrow(
  admin: SupabaseClient,
  userId: string,
  festivalId: string,
): Promise<void> {
  const role = await getUserFestivalRole(admin, userId, festivalId);
  if (role !== "owner") {
    throw new ForbiddenFestivalAccessError("Only the festival owner may perform this action.");
  }
}

export class ForbiddenFestivalAccessError extends Error {
  readonly status = 403 as const;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenFestivalAccessError";
  }
}
