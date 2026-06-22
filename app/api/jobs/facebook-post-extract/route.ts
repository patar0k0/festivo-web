import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { sendPosterBotMessage } from "@/lib/telegram/sendPosterBotMessage";
import { applyPosterProcessResult } from "@/lib/admin/poster/applyProcessResult";
import { posterBufferToInline, type InlineImage } from "@/lib/admin/poster/posterImageToInline";
import { uploadPosterImage } from "@/lib/admin/poster/uploadPosterImage";
import { extractFestivalFromFacebookPost } from "@/lib/admin/poster/extractFestivalFromFacebookPost";
import { enrichPosterFromWeb } from "@/lib/admin/poster/enrichPosterFromWeb";
import { buildPosterPendingRow } from "@/lib/admin/poster/posterPendingRowBuilder";
import { findDuplicateFestivals } from "@/lib/admin/research/findDuplicateFestivals";
import { insertPosterRow } from "@/lib/admin/poster/processPosterJob";
import { getBaseUrl } from "@/lib/config/baseUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DUP_BLOCK_SCORE = 0.5;

type Body = {
  posterIngestJobId?: string;
  sourceUrl?: string;
  text?: string;
  imageUrls?: string[];
};

export async function POST(req: Request) {
  if (!isAuthorizedJobRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.posterIngestJobId || !body?.sourceUrl || typeof body.text !== "string") {
    return NextResponse.json({ error: "posterIngestJobId, sourceUrl and text are required" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const baseUrl = getBaseUrl();
  const jobId = body.posterIngestJobId;
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];

  const { data: job } = await supabase
    .from("poster_ingest_jobs")
    .select("id,telegram_chat_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "poster_ingest_jobs row not found" }, { status: 404 });
  }
  const chatId = job.telegram_chat_id as number;

  await supabase.from("poster_ingest_jobs").update({ status: "processing", updated_at: new Date().toISOString() }).eq("id", jobId);

  try {
    let heroUrl: string | null = null;
    let inlineImage: InlineImage | null = null;

    if (imageUrls.length > 0) {
      await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "🖼 Качвам снимка от поста…" });
      const res = await fetch(imageUrls[0]);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
        inlineImage = await posterBufferToInline(buffer);
        heroUrl = await uploadPosterImage(supabase, buffer, mimeType);
      }
    }

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "🔍 Анализирам поста (Gemini)…" });
    const rawExtraction = await extractFestivalFromFacebookPost({ text: body.text, image: inlineImage });

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "🌐 Търся допълнителна информация в интернет…" });
    const extraction = await enrichPosterFromWeb(rawExtraction, rawExtraction.title.value ?? "");

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "📍 Геокодиране и проверка за дублати…" });
    const built = await buildPosterPendingRow(extraction, heroUrl);
    if (!built.ok) {
      await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, { kind: "error", message: built.error });
      return NextResponse.json({ ok: true });
    }

    const matches = await findDuplicateFestivals({ title: built.title, startDate: built.startDate });
    const strong = matches.filter((m) => m.score >= DUP_BLOCK_SCORE && m.same_year);
    if (strong.length > 0) {
      await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, {
        kind: "duplicate",
        matches: strong,
        extraction,
        heroUrl,
        title: built.title,
      });
      return NextResponse.json({ ok: true });
    }

    await sendPosterBotMessage("sendMessage", { chat_id: chatId, text: "💾 Записвам чернова…" });
    const result = await insertPosterRow(supabase, built.row, built.title);
    await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, result);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Facebook post processing failed";
    await applyPosterProcessResult(supabase, sendPosterBotMessage, baseUrl, chatId, jobId, { kind: "error", message });
    return NextResponse.json({ ok: true });
  }
}
