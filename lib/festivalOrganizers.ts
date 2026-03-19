import type { SupabaseClient } from "@supabase/supabase-js";

export type FestivalOrganizerLink = {
  festival_id: string;
  organizer_id: string;
  sort_order: number;
};

export function normalizeOrganizerIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const deduped = new Set<string>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
  }

  return Array.from(deduped);
}

export async function syncFestivalOrganizers(
  client: SupabaseClient,
  festivalId: string,
  organizerIds: string[],
): Promise<void> {
  const normalized = Array.from(new Set(organizerIds.map((value) => value.trim()).filter(Boolean)));

  const { error: deleteError } = await client.from("festival_organizers").delete().eq("festival_id", festivalId);
  if (deleteError) {
    throw new Error(`Failed to clear festival organizers: ${deleteError.message}`);
  }

  if (!normalized.length) return;

  const rows: FestivalOrganizerLink[] = normalized.map((organizerId, index) => ({
    festival_id: festivalId,
    organizer_id: organizerId,
    sort_order: index,
  }));

  const { error: insertError } = await client.from("festival_organizers").insert(rows);
  if (insertError) {
    throw new Error(`Failed to insert festival organizers: ${insertError.message}`);
  }
}
