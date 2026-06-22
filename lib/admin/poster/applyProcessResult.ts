import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInserted, formatDuplicate, dupKeyboard } from "@/lib/telegram/posterBot.mjs";
import type { ProcessResult } from "@/lib/admin/poster/processPosterJob";

export async function applyPosterProcessResult(
  supabase: SupabaseClient,
  tg: (method: string, payload: unknown) => Promise<void>,
  baseUrl: string,
  chatId: number,
  jobId: string | null,
  result: ProcessResult,
) {
  const now = new Date().toISOString();
  if (result.kind === "inserted") {
    if (jobId) {
      await supabase
        .from("poster_ingest_jobs")
        .update({ status: "done", pending_festival_id: result.pendingId, updated_at: now })
        .eq("id", jobId);
    }
    await tg("sendMessage", {
      chat_id: chatId,
      text: formatInserted({ pendingId: result.pendingId, title: result.title, needsReview: result.needsReview, baseUrl }),
      disable_web_page_preview: true,
    });
    return;
  }
  if (result.kind === "duplicate") {
    if (jobId) {
      await supabase
        .from("poster_ingest_jobs")
        .update({
          status: "awaiting_dup_confirm",
          dup_matches: result.matches,
          extraction_json: { extraction: result.extraction, heroUrl: result.heroUrl },
          updated_at: now,
        })
        .eq("id", jobId);
    }
    // Show the actual poster (already uploaded) so the operator can visually compare
    // it against the matched duplicates, instead of a generic festivo.bg link preview.
    const dupCaption = formatDuplicate(result.matches, baseUrl).slice(0, 1024);
    await tg("sendPhoto", {
      chat_id: chatId,
      photo: result.heroUrl,
      caption: dupCaption,
      reply_markup: jobId ? dupKeyboard(jobId, "0") : undefined,
    });
    return;
  }
  // error
  if (jobId) {
    await supabase.from("poster_ingest_jobs").update({ status: "error", error: result.message, updated_at: now }).eq("id", jobId);
  }
  await tg("sendMessage", { chat_id: chatId, text: `❌ Грешка при обработка: ${result.message}` });
}
