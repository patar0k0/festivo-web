import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFacebookEventUrl } from "@/lib/admin/ingest/normalizeFacebookEventUrl.mjs";
import { getSourceUrlMatchMeta } from "@/lib/admin/sourceUrlMatching";

export type EnqueueSubmissionSource = "ingest" | "telegram";

export type ExistingFestivalRef = { type: "pending" | "published"; id: string };

export type EnqueueFacebookEventResult =
  | { ok: true; kind: "queued"; jobId: string; status: string }
  | { ok: true; kind: "duplicate_warning"; jobId: string; status: string; existing: ExistingFestivalRef }
  | { ok: true; kind: "already_queued" }
  | { ok: false; kind: "error"; error: string; status: number };

/** Best-effort "is this link already a pending/published festival?" check. */
async function findExistingFestivalForUrl(
  supabase: SupabaseClient,
  sourceUrl: string,
): Promise<ExistingFestivalRef | null> {
  const eventId = getSourceUrlMatchMeta(sourceUrl)?.facebookEventId ?? null;

  // Published festivals are the stronger signal, so check them first.
  {
    let q = supabase.from("festivals").select("id").limit(1);
    q = eventId ? q.ilike("source_url", `%/events/${eventId}%`) : q.eq("source_url", sourceUrl);
    const { data } = await q.maybeSingle();
    if (data?.id) return { type: "published", id: String(data.id) };
  }
  {
    let q = supabase.from("pending_festivals").select("id").neq("status", "rejected").limit(1);
    q = eventId ? q.ilike("source_url", `%/events/${eventId}%`) : q.eq("source_url", sourceUrl);
    const { data } = await q.maybeSingle();
    if (data?.id) return { type: "pending", id: String(data.id) };
  }
  return null;
}

/**
 * Normalizes a Facebook event URL, checks for an existing record (warn-but-allow),
 * and inserts an ingest_jobs row. Shared by the admin route and the Telegram bot.
 */
export async function enqueueFacebookEventIngest(
  supabase: SupabaseClient,
  rawUrl: string,
  submissionSource: EnqueueSubmissionSource,
  opts?: { telegramUserId?: number | null },
): Promise<EnqueueFacebookEventResult> {
  const normalized = normalizeFacebookEventUrl(rawUrl);
  if ("error" in normalized) {
    return { ok: false, kind: "error", error: normalized.error, status: 400 };
  }
  const sourceUrl = normalized.value;

  const existing = await findExistingFestivalForUrl(supabase, sourceUrl);

  const payload_json: Record<string, unknown> = {
    schema_version: 1,
    submission_source: submissionSource,
  };
  if (typeof opts?.telegramUserId === "number") {
    payload_json.telegram_user_id = opts.telegramUserId;
  }

  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({
      source_url: sourceUrl,
      source_type: "facebook_event",
      status: "pending",
      payload_json,
    })
    .select("id,status")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: true, kind: "already_queued" };
    }
    return { ok: false, kind: "error", error: error.message, status: 500 };
  }
  if (!data?.id) {
    return { ok: false, kind: "error", error: "ingest_jobs insert did not return an id", status: 500 };
  }

  const jobId = String(data.id);
  const status = typeof data.status === "string" ? data.status : "pending";

  if (existing) {
    return { ok: true, kind: "duplicate_warning", jobId, status, existing };
  }
  return { ok: true, kind: "queued", jobId, status };
}
