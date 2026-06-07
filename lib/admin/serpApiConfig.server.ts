import "server-only";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export type SerpApiKeyIndex = "1" | "2" | "3";

const VALID_INDICES: SerpApiKeyIndex[] = ["1", "2", "3"];

/** Reads the active SerpAPI key index from admin_config. Defaults to "1" on error. */
export async function getActiveSerpApiKeyIndex(): Promise<SerpApiKeyIndex> {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("admin_config")
    .select("value")
    .eq("key", "serpapi_active_key")
    .single();
  const v = data?.value;
  return VALID_INDICES.includes(v) ? (v as SerpApiKeyIndex) : "1";
}

/** Cycles the active SerpAPI key index: 1 → 2 → 3 → 1. Returns the new index. */
export async function toggleSerpApiKeyIndex(): Promise<SerpApiKeyIndex> {
  const current = await getActiveSerpApiKeyIndex();
  const next: SerpApiKeyIndex = current === "1" ? "2" : current === "2" ? "3" : "1";
  const supabase = createSupabaseAdmin();
  await supabase
    .from("admin_config")
    .upsert({ key: "serpapi_active_key", value: next, updated_at: new Date().toISOString() });
  return next;
}

/** Persists a specific active SerpAPI key index. Used by automatic failover. */
export async function setActiveSerpApiKeyIndex(index: SerpApiKeyIndex): Promise<void> {
  const supabase = createSupabaseAdmin();
  await supabase
    .from("admin_config")
    .upsert({ key: "serpapi_active_key", value: index, updated_at: new Date().toISOString() });
}

/** Returns the active SerpAPI key string from env vars. */
export function resolveSerpApiKey(index: SerpApiKeyIndex): string | null {
  if (index === "3") return process.env.SERPAPI_KEY_3?.trim() || null;
  if (index === "2") return process.env.SERPAPI_KEY_2?.trim() || null;
  return (process.env.SERPAPI_KEY_1 ?? process.env.SERPAPI_KEY)?.trim() || null;
}

/** Returns all configured key indices in failover order starting from `from`. */
export function getSerpApiKeyOrder(from: SerpApiKeyIndex): SerpApiKeyIndex[] {
  const start = VALID_INDICES.indexOf(from);
  return [
    ...VALID_INDICES.slice(start),
    ...VALID_INDICES.slice(0, start),
  ].filter((idx) => !!resolveSerpApiKey(idx));
}
