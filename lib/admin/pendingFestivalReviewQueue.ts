import type { SupabaseClient } from "@supabase/supabase-js";

export type PendingReviewSortRow = {
  id: string;
  confidence_score: number | null;
  source_count: number | null;
  created_at: string;
};

/** Matches SQL: ORDER BY (confidence_score + COALESCE(source_count,0)*5) DESC, created_at ASC */
export function comparePendingReviewOrder(a: PendingReviewSortRow, b: PendingReviewSortRow): number {
  const ka = (Number(a.confidence_score) || 0) + (Number(a.source_count) || 0) * 5;
  const kb = (Number(b.confidence_score) || 0) + (Number(b.source_count) || 0) * 5;
  if (kb !== ka) return kb - ka;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export async function fetchAllPendingSortedIds(supabase: SupabaseClient): Promise<PendingReviewSortRow[]> {
  const pageSize = 1000;
  const out: PendingReviewSortRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("pending_festivals")
      .select("id,confidence_score,source_count,created_at")
      .eq("status", "pending")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) break;

    for (const r of data) {
      out.push({
        id: String(r.id),
        confidence_score: r.confidence_score ?? null,
        source_count: r.source_count ?? null,
        created_at: r.created_at,
      });
    }

    if (data.length < pageSize) break;
  }

  out.sort(comparePendingReviewOrder);
  return out;
}

export function pickNextPendingId(sorted: PendingReviewSortRow[], excludeIds: Set<string>): string | null {
  for (const row of sorted) {
    if (!excludeIds.has(row.id)) return row.id;
  }
  return null;
}
