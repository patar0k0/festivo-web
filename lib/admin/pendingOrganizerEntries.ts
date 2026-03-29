export type PendingOrganizerEntry = {
  organizer_id?: string | null;
  name: string;
};

function trimStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Parse DB jsonb / API body into normalized entries (non-empty names). */
export function parseOrganizerEntriesJson(value: unknown): PendingOrganizerEntry[] {
  if (!Array.isArray(value)) return [];
  const out: PendingOrganizerEntry[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    let name = trimStr((raw as { name?: unknown }).name) ?? "";
    let oid = trimStr((raw as { organizer_id?: unknown }).organizer_id);
    if (oid && !isUuidLike(oid)) oid = null;
    if (!oid && !name) continue;
    if (!name && oid) name = "—";
    const key = `${oid ?? ""}::${name.toLocaleLowerCase("bg-BG")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, organizer_id: oid ?? null });
  }
  return out;
}

type LegacyRow = {
  organizer_entries?: unknown;
  organizer_id?: string | null;
  organizer_name?: string | null;
};

/** Legacy: comma-separated organizer_name → multiple entries (fallback only). */
export function splitLegacyOrganizerNames(organizerName: string | null | undefined): string[] {
  const t = typeof organizerName === "string" ? organizerName.trim() : "";
  if (!t) return [];
  return t
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Resolve entries from a pending row (DB or API). */
export function pendingRowToOrganizerEntries(row: LegacyRow): PendingOrganizerEntry[] {
  const parsed = parseOrganizerEntriesJson(row.organizer_entries);
  if (parsed.length > 0) return parsed;

  if (row.organizer_id && trimStr(row.organizer_name)) {
    return [{ organizer_id: row.organizer_id, name: trimStr(row.organizer_name)! }];
  }
  if (row.organizer_id) {
    return [{ organizer_id: row.organizer_id, name: "—" }];
  }
  const split = splitLegacyOrganizerNames(row.organizer_name ?? null);
  if (split.length > 0) {
    return split.map((name) => ({ name }));
  }
  return [];
}

/** For festivals.organizer_name compatibility column: primary display string. */
export function primaryOrganizerDisplayName(entries: PendingOrganizerEntry[]): string | null {
  const first = entries[0];
  if (!first) return null;
  const n = first.name.trim();
  return n && n !== "—" ? n : null;
}
