import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildResearchPendingRowFromRequest, type ResearchEnqueueBody } from "@/lib/admin/ingest/researchPendingRowFromRequest";

const RESEARCH_SYNTHETIC_SOURCE_BASE = "https://research.festivo/pipeline";

function sanitizeJobSourceUrl(row: Record<string, unknown>): string {
  const raw = row.source_url;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  return `${RESEARCH_SYNTHETIC_SOURCE_BASE}/${randomUUID()}`;
}

export type InsertResearchIngestJobResult =
  | { ok: true; jobId: string; status: string }
  | { ok: false; error: string; status: number; code?: string };

/**
 * Enqueues admin research output as ingest_jobs (source_type=research) for the worker to insert pending_festivals.
 */
export async function insertResearchIngestJob(
  supabase: SupabaseClient,
  body: ResearchEnqueueBody | null,
): Promise<InsertResearchIngestJobResult> {
  const built = await buildResearchPendingRowFromRequest(body);
  if (!built.ok) {
    return { ok: false, error: built.error, status: built.status };
  }

  const jobSourceUrl = sanitizeJobSourceUrl(built.row);
  const pendingRow = { ...built.row, source_url: jobSourceUrl, submission_source: "research" };

  const payload_json = {
    schema_version: 1 as const,
    submission_source: "research" as const,
    research_provider: built.researchProvider,
    pending_row: pendingRow,
  };

  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({
      source_url: jobSourceUrl,
      source_type: "research",
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
