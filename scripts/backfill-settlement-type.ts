import * as fs from "node:fs";
import * as path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { FestivalSettlementType } from "@/lib/settlements/settlementType";
import { normalizeFestivalSettlementType } from "@/lib/settlements/settlementType";

type FestivalBackfillRow = {
  id: string;
  city: string | null;
  location_name?: string | null;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

const GEMINI_MODEL = process.env.GEMINI_RESEARCH_MODEL?.trim() || "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = Math.min(
  Math.max(Number.parseInt(process.env.GEMINI_RESEARCH_TIMEOUT_MS ?? "120000", 10) || 120_000, 15_000),
  180_000,
);

function geminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim() || null;
}

function isGeminiConfigured(): boolean {
  return Boolean(geminiApiKey());
}

async function geminiExtractJson<T>(options: {
  systemInstruction: string;
  userText: string;
  responseSchema?: Record<string, unknown>;
}): Promise<T> {
  const key = geminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    topP: 0.95,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  };
  if (options.responseSchema) {
    generationConfig.responseSchema = options.responseSchema;
  }
  const result = await model.generateContent(
    {
      systemInstruction: options.systemInstruction,
      contents: [{ role: "user", parts: [{ text: options.userText }] }],
      generationConfig: generationConfig as never,
    },
    { timeout: GEMINI_TIMEOUT_MS },
  );
  const json = result.response as GeminiGenerateResponse;
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Gemini returned empty JSON");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini JSON parse failed");
  }
}

const BATCH = 50;
const BETWEEN_GEMINI_MS = 900;
const BETWEEN_ROWS_MS = 120;

const KNOWN_SETTLEMENT: Record<string, FestivalSettlementType> = {
  арбанаси: "village",
  жеравна: "village",
  копривщица: "city",
};

const SETTLEMENT_SCHEMA = {
  type: "object",
  properties: {
    settlement_type: { type: "string", enum: ["city", "village", "resort"], nullable: true },
  },
  required: ["settlement_type"],
} as const;

const GEMINI_SYSTEM = `Ти класифицираш типа на българско населено място по подадени полета (град/локация от фестивален запис).
Върни JSON с поле settlement_type: "city" за град, "village" за село, "resort" за курорт или курортен комплекс (к.к.).
Ако няма достатъчно сигурност — settlement_type: null. Не измисляй.`;

function loadEnvFromDotenvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeHaystack(city: string | null, locationName: string | null): string {
  return [city ?? "", locationName ?? ""].join(" ").trim();
}

function heuristicSettlementType(city: string | null, locationName: string | null): FestivalSettlementType | null {
  const combined = normalizeHaystack(city, locationName);
  if (!combined) return null;

  const lower = combined.toLocaleLowerCase("bg-BG");
  for (const [place, kind] of Object.entries(KNOWN_SETTLEMENT)) {
    if (lower.includes(place)) return kind;
  }

  if (/\bк\.к\./i.test(combined)) return "resort";
  if (/\bгр\./i.test(combined)) return "city";
  if (/\bс\./i.test(combined)) return "village";

  if (lower.includes("курорт")) return "resort";
  if (lower.includes("град")) return "city";
  if (lower.includes("село")) return "village";

  return null;
}

type GeminiSettlementRequestPayload = {
  source: string | null;
  city: string | null;
  location_name: string | null;
};

function geminiSettlementRequestPayload(
  city: string | null,
  locationName: string | null,
): GeminiSettlementRequestPayload {
  const source = city || locationName;
  return { source, city, location_name: locationName };
}

/** Call only when `isGeminiConfigured()` is true — at most one API call per row. */
async function inferSettlementViaGemini(city: string | null, locationName: string | null): Promise<FestivalSettlementType | null> {
  const userText = JSON.stringify(geminiSettlementRequestPayload(city, locationName));
  try {
    const row = await geminiExtractJson<{ settlement_type: FestivalSettlementType | null }>({
      systemInstruction: GEMINI_SYSTEM,
      userText,
      responseSchema: { ...SETTLEMENT_SCHEMA } as Record<string, unknown>,
    });
    return normalizeFestivalSettlementType(row.settlement_type);
  } catch (e) {
    console.error("[backfill-settlement-type] Gemini error:", e instanceof Error ? e.message : e);
    return null;
  }
}

type BackfillSettlement = FestivalSettlementType | "unknown";
type BackfillInferenceVia = "heuristic" | "gemini" | "fallback-unknown";

async function resolveSettlementType(
  fromHeuristic: FestivalSettlementType | null,
  city: string | null,
  locationName: string | null,
  geminiReady: boolean,
): Promise<{ settlement: BackfillSettlement; via: BackfillInferenceVia }> {
  if (fromHeuristic !== null) {
    return { settlement: fromHeuristic, via: "heuristic" };
  }
  if (!geminiReady) {
    return { settlement: "unknown", via: "fallback-unknown" };
  }
  const fromGemini = await inferSettlementViaGemini(city, locationName);
  if (fromGemini !== null) {
    return { settlement: fromGemini, via: "gemini" };
  }
  return { settlement: "unknown", via: "fallback-unknown" };
}

async function main(): Promise<void> {
  loadEnvFromDotenvLocal();
  const supabase = createSupabaseAdmin();

  for (;;) {
    const { data: rows, error: selErr } = await supabase
      .from("festivals")
      .select("id,city,location_name")
      .is("settlement_type", null)
      .limit(BATCH)
      .returns<FestivalBackfillRow[]>();

    if (selErr) {
      console.error("[backfill-settlement-type] select error:", selErr);
      throw selErr;
    }

    if (!rows?.length) {
      console.log("[backfill-settlement-type] no more rows with null settlement_type");
      break;
    }

    for (const row of rows) {
      const id = String(row.id);
      const city = row.city?.trim() ? row.city : null;
      const loc = row.location_name;
      const locationName = typeof loc === "string" && loc.trim() ? loc : null;

      const geminiReady = isGeminiConfigured();
      const heuristicSt = heuristicSettlementType(city, locationName);
      const { settlement, via: inferenceVia } = await resolveSettlementType(
        heuristicSt,
        city,
        locationName,
        geminiReady,
      );
      const throttleMs = heuristicSt === null && geminiReady ? BETWEEN_GEMINI_MS : BETWEEN_ROWS_MS;

      const { data: updated, error: upErr } = await supabase
        .from("festivals")
        .update({ settlement_type: settlement })
        .eq("id", id)
        .is("settlement_type", null)
        .select("id");

      if (upErr) {
        console.error(`[backfill-settlement-type] update error id=${id}`, upErr);
        throw upErr;
      }

      if (updated?.length) {
        console.log(
          `[backfill-settlement-type] updated id=${id} via=${inferenceVia} settlement_type=${settlement}`,
        );
      } else {
        console.log(`[backfill-settlement-type] skipped update (already set?) id=${id}`);
      }

      await sleep(throttleMs);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
