import { geminiExtractJson, isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import type { McGovScrapedEvent } from "@/lib/admin/ingest/mcGov/parseListPage";

export type PrescreenResult = {
  is_festival: boolean;
  score: number;
  reason: string;
};

export const PRESCREEN_SCORE_THRESHOLD = 60;

export function buildPrescreenPrompt(event: McGovScrapedEvent): string {
  return [
    `Заглавие: "${event.title}"`,
    `Организатор: "${event.organizerName ?? "неизвестен"}"`,
    `Локация: "${event.locationName ?? "неизвестна"}"`,
    `Дата: ${event.startDate ?? "неизвестна"}`,
    "",
    "Това многодневно/традиционно културно събитие (фестивал, събор, панаир)",
    "подходящо за публичен фестивален каталог ли е, или е по-скоро формална",
    "общинска церемония (годишнина, награждаване, отбелязване)?",
    "",
    'Върни JSON: {"is_festival": bool, "score": 0-100, "reason": "кратко"}',
  ].join("\n");
}

export function parsePrescreenResponse(raw: unknown): PrescreenResult | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.is_festival !== "boolean") return null;
  if (typeof obj.score !== "number" || !Number.isFinite(obj.score)) return null;

  const score = Math.max(0, Math.min(100, Math.round(obj.score)));
  const reason = typeof obj.reason === "string" ? obj.reason : "";

  return { is_festival: obj.is_festival, score, reason };
}

export async function runPrescreen(event: McGovScrapedEvent): Promise<PrescreenResult | null> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");

  const raw = await geminiExtractJson<unknown>({
    systemInstruction:
      "Ти си асистент, който помага на администратор на фестивален каталог да филтрира кои културни събития си струва да бъдат разгледани ръчно.",
    userText: buildPrescreenPrompt(event),
  });

  return parsePrescreenResponse(raw);
}
