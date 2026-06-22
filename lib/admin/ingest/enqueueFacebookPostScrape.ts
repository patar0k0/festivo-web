import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeFacebookPostUrl } from "./normalizeFacebookPostUrl.mjs";
import { buildPosterUrlDedupeKey } from "../../telegram/posterBot.mjs";
import { checkExistingPosterJob } from "../poster/posterJobIdempotency";
import type { ExistingFestivalRef } from "./enqueueFacebookEventIngest";

export type EnqueueFacebookPostScrapeResult =
  | { ok: true; kind: "queued" }
  | { ok: true; kind: "duplicate_warning"; jobId: string; status: string; existing: ExistingFestivalRef }
  | { ok: true; kind: "already_queued" }
  | { ok: false; kind: "error"; error: string; status: number };

/**
 * Normalizes a Facebook post/permalink/story URL, checks for an in-flight or
 * already-resolved submission via poster_ingest_jobs, and — if new — writes
 * both a poster_ingest_jobs row (UX/state) and an ingest_jobs row for
 * festivo-workers to scrape.
 */
export async function enqueueFacebookPostScrape(
  supabase: SupabaseClient,
  rawUrl: string,
  opts: { telegramChatId: number; telegramUserId: number },
): Promise<EnqueueFacebookPostScrapeResult> {
  // normalizeFacebookPostUrl.mjs has no JSDoc types, so TS's JS-without-checkJs
  // inference merges its return branches into one shape with optional props
  // instead of a clean union — assert the documented contract explicitly.
  const normalized = normalizeFacebookPostUrl(rawUrl) as { value: string } | { error: string };
  if ("error" in normalized) {
    return { ok: false, kind: "error", error: normalized.error, status: 400 };
  }
  const sourceUrl = normalized.value;
  const dedupeKey = buildPosterUrlDedupeKey(opts.telegramChatId, sourceUrl);

  const { existingId, decision } = await checkExistingPosterJob(supabase, dedupeKey);
  if (decision.action === "still_processing") {
    return { ok: true, kind: "already_queued" };
  }
  if (decision.action === "already_done") {
    if (!decision.pendingId || !existingId) return { ok: true, kind: "already_queued" };
    // poster_ingest_jobs.pending_festival_id only ever points at pending_festivals
    // (set by applyPosterProcessResult's "inserted" branch via insertPosterRow).
    return {
      ok: true,
      kind: "duplicate_warning",
      jobId: existingId,
      status: "done",
      existing: { type: "pending", id: decision.pendingId },
    };
  }

  const { data: job, error: upsertErr } = await supabase
    .from("poster_ingest_jobs")
    .upsert(
      {
        telegram_chat_id: opts.telegramChatId,
        telegram_user_id: opts.telegramUserId,
        status: "queued_scrape",
        dedupe_key: dedupeKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key" },
    )
    .select("id")
    .single();

  if (upsertErr || !job?.id) {
    return { ok: false, kind: "error", error: upsertErr?.message ?? "poster_ingest_jobs upsert failed", status: 500 };
  }
  const posterIngestJobId = String(job.id);

  const { error: ingestErr } = await supabase.from("ingest_jobs").insert({
    source_url: sourceUrl,
    source_type: "facebook_post",
    job_type: "scrape_facebook_post",
    status: "queued",
    payload_json: {
      poster_ingest_job_id: posterIngestJobId,
      telegram_chat_id: opts.telegramChatId,
      telegram_user_id: opts.telegramUserId,
      submission_source: "telegram",
    },
  });

  if (ingestErr) {
    if (ingestErr.code === "23505") {
      return { ok: true, kind: "already_queued" };
    }
    return { ok: false, kind: "error", error: ingestErr.message, status: 500 };
  }

  return { ok: true, kind: "queued" };
}
