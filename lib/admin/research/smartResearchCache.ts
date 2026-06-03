import "server-only";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SmartResearchResult } from "@/lib/admin/research/smart-pipeline";

const admin = createSupabaseAdmin();

/**
 * Best-effort cache for Smart Research results, backed by `research_smart_cache`
 * (see scripts/sql/20260602_research_smart_cache.sql). Saves SerpAPI credits +
 * Gemini tokens on repeated identical queries.
 *
 * Every operation is wrapped so a missing table / DB hiccup degrades gracefully
 * to "no cache" — the pipeline simply runs as before. The cache is never allowed
 * to block or break a research run.
 */

// Festival metadata is fairly stable; 6h keeps results fresh enough while
// absorbing repeated lookups during an admin moderation session.
const TTL_MS = 6 * 60 * 60 * 1000;

export function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export type CachedSmartResearch = {
  result: SmartResearchResult;
  cachedAt: string;
};

export async function getCachedSmartResearch(query: string): Promise<CachedSmartResearch | null> {
  const key = normalizeQueryKey(query);
  if (!key) return null;
  try {
    const { data, error } = await admin
      .from("research_smart_cache")
      .select("result,created_at")
      .eq("query_key", key)
      .single();

    if (error || !data?.result || !data.created_at) return null;

    const age = Date.now() - new Date(data.created_at as string).getTime();
    if (!Number.isFinite(age) || age > TTL_MS) return null;

    const result = data.result as SmartResearchResult;
    if (!result || typeof result !== "object" || !result.fields || !result.confidence) return null;

    return { result, cachedAt: data.created_at as string };
  } catch {
    return null;
  }
}

export async function setCachedSmartResearch(query: string, result: SmartResearchResult): Promise<void> {
  const key = normalizeQueryKey(query);
  if (!key) return;
  try {
    await admin.from("research_smart_cache").upsert(
      {
        query_key: key,
        query_original: query.trim(),
        result: result as unknown as Record<string, unknown>,
        created_at: new Date().toISOString(),
      },
      { onConflict: "query_key" },
    );
  } catch {
    // Cache write failure is non-fatal.
  }
}
