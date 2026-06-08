import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  verifyWebhookSecret,
  mapUpdateToAction,
  buildDedupeKey,
  normalizeTargets,
  decisionToStatus,
} from "@/lib/telegram/socialBot.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TG_API = (m: string) =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${m}`;

async function tg(method: string, payload: unknown) {
  try {
    await fetch(TG_API(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Telegram delivery is best-effort; never fail the webhook on send errors.
  }
}

export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secret, process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = await req.json();
  const action = mapUpdateToAction(update);
  if (action.kind === "ignore") return NextResponse.json({ ok: true });

  const supabase = createSupabaseAdmin();

  // whitelist gate
  const { data: allowed } = await supabase
    .from("social_repost_allowed_users")
    .select("telegram_user_id")
    .eq("telegram_user_id", action.userId)
    .maybeSingle();
  if (!allowed) {
    await tg("sendMessage", { chat_id: action.chatId, text: "Нямаш достъп до този бот." });
    return NextResponse.json({ ok: true });
  }

  if (action.kind === "enqueue") {
    const dedupe_key = buildDedupeKey(action.chatId, action.url);
    await supabase.from("social_repost_jobs").upsert(
      {
        telegram_chat_id: action.chatId,
        telegram_user_id: action.userId,
        source_url: action.url,
        status: "queued",
        dedupe_key,
      },
      { onConflict: "dedupe_key" }
    );
    await tg("sendMessage", { chat_id: action.chatId, text: "⏳ Получих линка, свалям клипа…" });
  } else if (action.kind === "toggle") {
    const { data: job } = await supabase
      .from("social_repost_jobs")
      .select("targets")
      .eq("id", action.jobId)
      .maybeSingle();
    const cur: string[] = Array.isArray(job?.targets) ? (job!.targets as string[]) : [];
    const next = cur.includes(action.network)
      ? cur.filter((t) => t !== action.network)
      : [...cur, action.network];
    const normalized = normalizeTargets(next);
    await supabase.from("social_repost_jobs").update({ targets: normalized }).eq("id", action.jobId);
    await tg("answerCallbackQuery", {
      callback_query_id: action.callbackQueryId,
      text: `Мрежи: ${normalized.join(", ") || "няма"}`,
    });
  } else if (action.kind === "decision") {
    const status = decisionToStatus(action.decision);
    if (status) {
      await supabase.from("social_repost_jobs").update({ status }).eq("id", action.jobId);
    }
    await tg("answerCallbackQuery", {
      callback_query_id: action.callbackQueryId,
      text: status === "publishing" ? "Публикувам…" : status || "ок",
    });
  } else if (action.kind === "caption") {
    const { data: job } = await supabase
      .from("social_repost_jobs")
      .select("id")
      .eq("telegram_chat_id", action.chatId)
      .eq("status", "awaiting_review")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (job) {
      await supabase.from("social_repost_jobs").update({ caption: action.text }).eq("id", job.id);
      await tg("sendMessage", { chat_id: action.chatId, text: "✏️ Описанието е записано." });
    }
  }

  return NextResponse.json({ ok: true });
}
