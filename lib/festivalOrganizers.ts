import type { SupabaseClient } from "@supabase/supabase-js";

export type FestivalOrganizerRole = "owner" | "co_host";

export type FestivalOrganizerLink = {
  festival_id: string;
  organizer_id: string;
  sort_order: number;
  role: FestivalOrganizerRole;
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

type SyncOptions = {
  /**
   * Когато е подаден, тази стойност определя кой organizer_id ще получи role='owner'
   * на финалния set. Останалите получават co_host. Ако ownerOrganizerId не е в
   * organizerIds, фестивалът остава orphan (всички co_host).
   */
  ownerOrganizerId?: string | null;
};

/**
 * Препише festival_organizers за даден festival до точно подадения списък,
 * запазвайки съществуващите role-и където е възможно. Поведение:
 *  - Запазват се role-ите на organizer_id-ите, които остават след sync.
 *  - Новите organizer_id-и влизат с role='co_host'.
 *  - Ако `options.ownerOrganizerId` е подаден и присъства в списъка, той става owner;
 *    останалите получават co_host (един owner на festival).
 *  - Ако `options.ownerOrganizerId` не е подаден → текущият owner (ако още е в списъка)
 *    остава owner. Иначе festival-ът остава без owner (orphan).
 */
export async function syncFestivalOrganizers(
  client: SupabaseClient,
  festivalId: string,
  organizerIds: string[],
  options: SyncOptions = {},
): Promise<void> {
  const normalized = Array.from(
    new Set(organizerIds.map((value) => value.trim()).filter(Boolean)),
  );

  // 1) Прочети текущите редове (за да знаем кой е owner и какво да запазим).
  const { data: existingRows, error: readError } = await client
    .from("festival_organizers")
    .select("organizer_id, role")
    .eq("festival_id", festivalId);

  if (readError) {
    throw new Error(`Failed to read existing festival organizers: ${readError.message}`);
  }

  const existingRoleByOrganizerId = new Map<string, FestivalOrganizerRole>();
  for (const row of existingRows ?? []) {
    if (row.organizer_id && (row.role === "owner" || row.role === "co_host")) {
      existingRoleByOrganizerId.set(row.organizer_id, row.role);
    }
  }

  // 2) Изтрий всички редове за festival-а.
  const { error: deleteError } = await client
    .from("festival_organizers")
    .delete()
    .eq("festival_id", festivalId);
  if (deleteError) {
    throw new Error(`Failed to clear festival organizers: ${deleteError.message}`);
  }

  if (!normalized.length) return;

  // 3) Определи owner-а за финалния set.
  const explicitOwner =
    options.ownerOrganizerId && normalized.includes(options.ownerOrganizerId)
      ? options.ownerOrganizerId
      : null;
  const preservedOwner = !explicitOwner
    ? normalized.find((id) => existingRoleByOrganizerId.get(id) === "owner") ?? null
    : null;
  const finalOwnerId = explicitOwner ?? preservedOwner;

  // 4) Конструирай редовете.
  const rows: FestivalOrganizerLink[] = normalized.map((organizerId, index) => {
    const role: FestivalOrganizerRole =
      organizerId === finalOwnerId ? "owner" : "co_host";
    return {
      festival_id: festivalId,
      organizer_id: organizerId,
      sort_order: index,
      role,
    };
  });

  const { error: insertError } = await client.from("festival_organizers").insert(rows);
  if (insertError) {
    throw new Error(`Failed to insert festival organizers: ${insertError.message}`);
  }
}
