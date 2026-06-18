import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  verifyWebhookSecret,
  mapPosterUpdate,
  buildPosterDedupeKey,
  formatInserted,
  formatDuplicate,
  formatAlreadyDone,
  formatRejected,
  dupKeyboard,
  reprocessKeyboard,
} from "@/lib/telegram/posterBot.mjs";
import {
  processPosterFromFile,
  insertFromStoredExtraction,
  type ProcessResult,
} from "@/lib/admin/poster/processPosterJob";
import { getBaseUrl } from "@/lib/config/baseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TG = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_POSTER_BOT_TOKEN}/${m}`;

async function tg(method: string, payload: unknown) {
  try {
    await fetch(TG(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort; never fail the webhook on delivery errors
  }
}

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

  if (action.kind === "photo") {
    const dedupe_key = buildPosterDedupeKey(action.chatId, action.fileUniqueId);

    // Idempotency: skip if this exact poster was already processed to a result.
    const { data: existing } = await supabase
      .from("poster_ingest_jobs")
      .select("id,status,pending_festival_id")
      .eq("dedupe_key", dedupe_key)
      .maybeSingle();
    if (existing?.status === "processing") {
      await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Плакатът се обработва в момента — изчакай малко." });
      return NextResponse.json({ ok: true });
    }
    if (existing?.status === "done") {
      let isRejected = false;
      if (existing.pending_festival_id) {
        const { data: pf } = await supabase
          .from("pending_festivals")
          .select("status")
          .eq("id", existing.pending_festival_id)
          .maybeSingle();
        isRejected = pf?.status === "rejected";
      }
      const text = isRejected
        ? formatRejected({ pendingId: existing.pending_festival_id ?? null, baseUrl })
        : formatAlreadyDone({ pendingId: existing.pending_festival_id ?? null, baseUrl });
      await tg("sendMessage", {
        chat_id: action.chatId,
        text,
        reply_markup: reprocessKeyboard(String(existing.id)),
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

    const result = await processPosterFromFile(supabase, action.fileId, action.caption);
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
      const result = await processPosterFromFile(supabase, String(job.tg_file_id), "");
      await applyResult(supabase, tg, baseUrl, action.chatId, String(job.id), result);
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

async function applyResult(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  tg: (m: string, p: unknown) => Promise<void>,
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
    await tg("sendMessage", {
      chat_id: chatId,
      text: formatDuplicate(result.matches, baseUrl),
      reply_markup: jobId ? dupKeyboard(jobId) : undefined,
    });
    return;
  }
  // error
  if (jobId) {
    await supabase.from("poster_ingest_jobs").update({ status: "error", error: result.message, updated_at: now }).eq("id", jobId);
  }
  await tg("sendMessage", { chat_id: chatId, text: `❌ Грешка при обработка: ${result.message}` });
}
