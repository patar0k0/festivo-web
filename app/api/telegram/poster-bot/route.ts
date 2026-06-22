import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  verifyWebhookSecret,
  mapPosterUpdate,
  buildPosterDedupeKey,
  formatEnriched,
  formatAlreadyDone,
  formatRejected,
  reprocessKeyboard,
  formatUrlResultLine,
} from "@/lib/telegram/posterBot.mjs";
import { applyPosterEnrichment } from "@/lib/admin/poster/applyPosterEnrichment";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";
import { processPosterFromFile, insertFromStoredExtraction } from "@/lib/admin/poster/processPosterJob";
import { enqueueFacebookEventIngest } from "@/lib/admin/ingest/enqueueFacebookEventIngest";
import { getBaseUrl } from "@/lib/config/baseUrl";
import { sendPosterBotMessage as tg } from "@/lib/telegram/sendPosterBotMessage";
import { applyPosterProcessResult as applyResult } from "@/lib/admin/poster/applyProcessResult";
import { checkExistingPosterJob } from "@/lib/admin/poster/posterJobIdempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secret, process.env.TELEGRAM_POSTER_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const action = mapPosterUpdate(update);
  if (action.kind === "ignore") return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdmin();
  const baseUrl = getBaseUrl();

  // whitelist gate (shared with the social bot)
  const { data: allowed } = await supabase
    .from("social_repost_allowed_users")
    .select("telegram_user_id")
    .eq("telegram_user_id", action.userId)
    .maybeSingle();
  if (!allowed) {
    await tg("sendMessage", { chat_id: action.chatId, text: "Нямаш достъп до този бот." });
    return NextResponse.json({ ok: true });
  }

  if (action.kind === "url") {
    const urls = "urls" in action && Array.isArray(action.urls) && action.urls.length > 0 ? action.urls : [action.url];
    const lines: string[] = [];
    let anyQueued = false;

    for (const url of urls) {
      const result = await enqueueFacebookEventIngest(supabase, url, "telegram", { telegramUserId: action.userId });
      lines.push(formatUrlResultLine(url, result, baseUrl));
      if (result.ok && (result.kind === "queued" || result.kind === "duplicate_warning")) {
        anyQueued = true;
      }
    }

    if (anyQueued) lines.push("\n⏳ Работниците ще обработят линка скоро.");
    await tg("sendMessage", { chat_id: action.chatId, text: lines.join("\n") });
    return NextResponse.json({ ok: true });
  }

  if (action.kind === "photo") {
    const dedupe_key = buildPosterDedupeKey(action.chatId, action.fileUniqueId);

    // Idempotency: skip if this exact poster was already processed to a result.
    const { existingId, decision } = await checkExistingPosterJob(supabase, dedupe_key);
    if (decision.action === "still_processing") {
      await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Плакатът се обработва в момента — изчакай малко." });
      return NextResponse.json({ ok: true });
    }
    if (decision.action === "already_done") {
      const text = decision.rejected
        ? formatRejected({ pendingId: decision.pendingId, baseUrl })
        : formatAlreadyDone({ pendingId: decision.pendingId, baseUrl });
      await tg("sendMessage", {
        chat_id: action.chatId,
        text,
        reply_markup: reprocessKeyboard(String(existingId)),
        disable_web_page_preview: true,
      });
      return NextResponse.json({ ok: true });
    }

    const { data: job } = await supabase
      .from("poster_ingest_jobs")
      .upsert(
        {
          telegram_chat_id: action.chatId,
          telegram_user_id: action.userId,
          tg_file_id: action.fileId,
          tg_file_unique_id: action.fileUniqueId,
          status: "processing",
          dedupe_key,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dedupe_key" },
      )
      .select("id")
      .single();

    const jobId = job?.id ? String(job.id) : null;
    await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Разчитам плаката…" });

    const result = await processPosterFromFile(supabase, action.fileId, action.caption, (label) =>
      tg("sendMessage", { chat_id: action.chatId, text: label }),
    );
    await applyResult(supabase, tg, baseUrl, action.chatId, jobId, result);
    return NextResponse.json({ ok: true });
  }

  if (action.kind === "dup-decision") {
    const { data: job } = await supabase
      .from("poster_ingest_jobs")
      .select("id,status,extraction_json,telegram_chat_id,tg_file_id")
      .eq("id", action.jobId)
      .maybeSingle();

    await tg("answerCallbackQuery", { callback_query_id: action.callbackQueryId, text: "ок" });

    if (!job) {
      return NextResponse.json({ ok: true });
    }

    if (action.decision === "reprocess") {
      await supabase
        .from("poster_ingest_jobs")
        .update({ status: "processing", pending_festival_id: null, error: null, updated_at: new Date().toISOString() })
        .eq("id", job.id);
      await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Преработвам плаката…" });
      const result = await processPosterFromFile(supabase, String(job.tg_file_id), "", (label) =>
        tg("sendMessage", { chat_id: action.chatId, text: label }),
      );
      await applyResult(supabase, tg, baseUrl, action.chatId, String(job.id), result);
      return NextResponse.json({ ok: true });
    }

    if (action.decision === "enrich") {
      const stored = job.extraction_json as { extraction?: unknown; heroUrl?: string } | null;
      if (!stored?.extraction) {
        await tg("sendMessage", { chat_id: action.chatId, text: "❌ Липсват запазени данни за обогатяване." });
        return NextResponse.json({ ok: true });
      }
      const matches = (job as { dup_matches?: unknown }).dup_matches;
      const target = Array.isArray(matches) ? (matches as DuplicateMatch[])[Number(action.dupId)] ?? null : null;
      if (!target) {
        await tg("sendMessage", { chat_id: action.chatId, text: "❌ Не намерих записа за обогатяване." });
        return NextResponse.json({ ok: true });
      }
      const enrichResult = await applyPosterEnrichment(
        supabase,
        stored.extraction as Parameters<typeof applyPosterEnrichment>[1],
        target,
        String(job.id),
      );
      if (!enrichResult.ok) {
        await tg("sendMessage", { chat_id: action.chatId, text: `❌ Грешка при обогатяване: ${enrichResult.error}` });
        return NextResponse.json({ ok: true });
      }
      await supabase.from("poster_ingest_jobs").update({ status: "enriched", updated_at: new Date().toISOString() }).eq("id", job.id);
      await tg("sendMessage", {
        chat_id: action.chatId,
        text: formatEnriched({
          kind: enrichResult.kind,
          fields: enrichResult.kind !== "nothing_to_patch" ? enrichResult.fields : [],
          baseUrl,
          targetId: target.id,
          targetTable: target.table,
        }),
        disable_web_page_preview: true,
      });
      return NextResponse.json({ ok: true });
    }

    if (job.status !== "awaiting_dup_confirm") {
      return NextResponse.json({ ok: true });
    }

    if (action.decision === "discard") {
      await supabase.from("poster_ingest_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", job.id);
      await tg("sendMessage", { chat_id: action.chatId, text: "Отказано — нищо не е създадено." });
      return NextResponse.json({ ok: true });
    }

    // create anyway, from the stored extraction
    const stored = job.extraction_json as { extraction?: unknown; heroUrl?: string } | null;
    if (!stored?.extraction || !stored.heroUrl) {
      await tg("sendMessage", { chat_id: action.chatId, text: "❌ Липсват запазени данни за повторно създаване." });
      return NextResponse.json({ ok: true });
    }
    const result = await insertFromStoredExtraction(
      supabase,
      stored.extraction as Parameters<typeof insertFromStoredExtraction>[1],
      stored.heroUrl,
    );
    await applyResult(supabase, tg, baseUrl, action.chatId, String(job.id), result);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
