import type { SupabaseClient } from "@supabase/supabase-js";

export type InsertDiscoveryIngestJobResult =
  | { ok: true; jobId: string; status: string }
  | { ok: false; error: string; status: number; code?: string };

function normalizeHttpUrl(input: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = input.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "URL must start with http or https." };
  }
  parsed.hash = "";
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  parsed.pathname = path;
  return { ok: true, value: parsed.toString() };
}

/**
 * Enqueues a URL discovered offline for scrape ingest with submission_source=discovery on the resulting pending row (worker).
 */
export async function insertDiscoveryIngestJob(
  supabase: SupabaseClient,
  sourceUrl: string,
  meta?: { discovered_link_id?: string | null },
): Promise<InsertDiscoveryIngestJobResult> {
  const norm = normalizeHttpUrl(sourceUrl);
  if (!norm.ok) {
    return { ok: false, error: norm.error, status: 400 };
  }

  const payload_json = {
    schema_version: 1 as const,
    submission_source: "discovery" as const,
    discovered_link_id: meta?.discovered_link_id ?? null,
  };

  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({
      source_url: norm.value,
      source_type: "discovery",
      status: "pending",
      payload_json,
    })
    .select("id,status")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "A job with this source_url already exists.", status: 409, code: error.code };
    }
    return { ok: false, error: error.message, status: 500 };
  }

  if (!data?.id) {
    return { ok: false, error: "ingest_jobs insert did not return an id", status: 500 };
  }

  return { ok: true, jobId: String(data.id), status: typeof data.status === "string" ? data.status : "pending" };
}
