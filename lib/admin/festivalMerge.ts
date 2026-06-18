/**
 * Winner-authoritative festival columns that may be back-filled from the loser
 * when empty on the winner. Excludes identity/moderation fields
 * (title, slug, city_id, category, start_date, status, source_url, verification_*).
 */
export const MERGE_FILL_NULL_FIELDS = [
  "description",
  "website_url",
  "ticket_url",
  "price_range",
  "hero_image",
  "image_url",
  "video_url",
  "latitude",
  "longitude",
  "place_id",
  "geocode_provider",
  "address",
  "organizer_name",
  "end_date",
  "start_time",
  "end_time",
  "occurrence_dates",
] as const;

export type FestivalLike = Record<string, unknown>;

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function mergeTags(winnerTags: unknown, loserTags: unknown): string[] {
  const w = Array.isArray(winnerTags) ? winnerTags.filter((t): t is string => typeof t === "string") : [];
  const l = Array.isArray(loserTags) ? loserTags.filter((t): t is string => typeof t === "string") : [];
  const out = [...w];
  for (const t of l) if (!out.includes(t)) out.push(t);
  return out;
}

/** Returns only the columns to update on the winner (fill-null + tag union). */
export function computeFillNullPatch(winner: FestivalLike, loser: FestivalLike): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const field of MERGE_FILL_NULL_FIELDS) {
    if (isEmpty(winner[field]) && !isEmpty(loser[field])) {
      patch[field] = loser[field];
    }
  }
  const mergedTags = mergeTags(winner.tags, loser.tags);
  const winnerTagCount = Array.isArray(winner.tags) ? winner.tags.length : 0;
  if (mergedTags.length > winnerTagCount) patch.tags = mergedTags;
  return patch;
}
