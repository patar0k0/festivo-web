export type GeocodeMeta = {
  source: "place_id" | "venue+city" | "venue_only";
  query: string;
  resultName?: string;
  resultAddress?: string;
};

/** Tokens ignored for overlap so generic venue lines ("гр. София концерт") do not match on city alone. */
const OVERLAP_STOPWORDS = new Set(["гр", "гр.", "концерт", "събор", "фестивал"]);

export function scoreGeocodeResult(meta: GeocodeMeta): number {
  let score = 0;

  // source weight
  if (meta.source === "place_id") score += 50;
  if (meta.source === "venue+city") score += 40;
  if (meta.source === "venue_only") score += 20;

  const query = meta.query.toLowerCase();
  const result = (meta.resultName ?? "").toLowerCase();

  // name match
  if (result && query.includes(result)) score += 20;

  // token overlap (unique tokens; omit generic/event fluff)
  const tokens = [...new Set(query.split(/[ ,]+/).filter(Boolean))].filter((t) => !OVERLAP_STOPWORDS.has(t));
  const overlap = tokens.filter((t) => result.includes(t)).length;
  score += overlap * 3;

  return score;
}
