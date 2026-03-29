/**
 * Server-only Gemini REST client (generateContent). Grounding uses the google_search tool.
 * Env: GEMINI_API_KEY (or GOOGLE_AI_API_KEY). Optional: GEMINI_RESEARCH_MODEL (default gemini-2.0-flash).
 */

const DEFAULT_MODEL = process.env.GEMINI_RESEARCH_MODEL?.trim() || "gemini-2.0-flash";
const DEFAULT_TIMEOUT_MS = Math.min(Math.max(Number.parseInt(process.env.GEMINI_RESEARCH_TIMEOUT_MS ?? "120000", 10) || 120_000, 15_000), 180_000);

export type GeminiGroundingChunk = {
  web?: { uri?: string; title?: string; domain?: string };
  retrievedContext?: { uri?: string; title?: string; text?: string };
  image?: { sourceUri?: string; title?: string; domain?: string };
};

export type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: GeminiGroundingMetadata;
    /** Some clients / JSON variants use snake_case (Python-style names). */
    grounding_metadata?: GeminiGroundingMetadata;
  }>;
  error?: { message?: string; code?: number };
};

type GeminiGroundingMetadata = {
  webSearchQueries?: string[];
  web_search_queries?: string[];
  groundingChunks?: GeminiGroundingChunk[];
  grounding_chunks?: GeminiGroundingChunk[];
  groundingSupports?: Array<{
    groundingChunkIndices?: number[];
    grounding_chunk_indices?: number[];
    segment?: { text?: string };
  }>;
  grounding_supports?: Array<{
    groundingChunkIndices?: number[];
    grounding_chunk_indices?: number[];
    segment?: { text?: string };
  }>;
};

function getApiKey(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_AI_API_KEY?.trim();
  return k || null;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getApiKey());
}

async function postGenerateContent(body: Record<string, unknown>): Promise<GeminiGenerateResponse> {
  const key = getApiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const json = (await response.json().catch(() => ({}))) as GeminiGenerateResponse & { error?: { message?: string } };

  if (!response.ok) {
    const msg = json.error?.message ?? `Gemini HTTP ${response.status}`;
    throw new Error(msg);
  }

  if (json.error?.message) {
    throw new Error(json.error.message);
  }

  return json;
}

/**
 * Temporary debug: set GEMINI_RESEARCH_DEBUG=1 to log raw Gemini search responses (truncated).
 */
const GEMINI_DEBUG = process.env.GEMINI_RESEARCH_DEBUG === "1";

function logGeminiSearchDebug(label: string, payload: unknown): void {
  if (!GEMINI_DEBUG) return;
  try {
    const s = JSON.stringify(payload);
    const truncated = s.length > 14_000 ? `${s.slice(0, 14_000)}…[truncated ${s.length - 14_000} chars]` : s;
    console.warn(`[gemini-grounded-search] ${label}: ${truncated}`);
  } catch {
    console.warn(`[gemini-grounded-search] ${label}: <unserializable>`);
  }
}

type GeminiCandidate = NonNullable<GeminiGenerateResponse["candidates"]>[number];

function pickGroundingMetadata(candidate: GeminiCandidate | undefined): GeminiGroundingMetadata | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const c = candidate as { groundingMetadata?: GeminiGroundingMetadata; grounding_metadata?: GeminiGroundingMetadata };
  return c.groundingMetadata ?? c.grounding_metadata;
}

function normalizeChunks(gm: GeminiGroundingMetadata | undefined): GeminiGroundingChunk[] {
  if (!gm) return [];
  return gm.groundingChunks ?? gm.grounding_chunks ?? [];
}

function normalizeSupports(
  gm: GeminiGroundingMetadata | undefined,
): Array<{ groundingChunkIndices?: number[]; grounding_chunk_indices?: number[] }> {
  if (!gm) return [];
  return gm.groundingSupports ?? gm.grounding_supports ?? [];
}

function isHttpUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

function hitFromChunk(ch: GeminiGroundingChunk): { url: string; title: string; snippet: string } | null {
  const w = ch.web;
  if (w?.uri && isHttpUrl(w.uri)) {
    const url = w.uri.trim();
    const title = (w.title ?? "").trim() || w.domain?.trim() || url;
    return { url, title, snippet: title };
  }
  const rc = ch.retrievedContext;
  if (rc?.uri && isHttpUrl(rc.uri)) {
    const url = rc.uri.trim();
    const title = (rc.title ?? "").trim() || url;
    const snippet = (rc.text ?? rc.title ?? "").trim() || title;
    return { url, title, snippet };
  }
  const im = ch.image;
  if (im?.sourceUri && isHttpUrl(im.sourceUri)) {
    const url = im.sourceUri.trim();
    const title = (im.title ?? "").trim() || url;
    return { url, title, snippet: title };
  }
  return null;
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s\]>)"',]+/gi;

function extractUrlsFromModelText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(URL_IN_TEXT)) {
    const raw = m[0]?.replace(/[),.;]+$/, "") ?? "";
    if (!raw || !isHttpUrl(raw) || seen.has(raw)) continue;
    seen.add(raw);
    found.push(raw);
  }
  return found;
}

/**
 * Collect search hits from generateContent response: groundingChunks, supports indices, then URLs in model text.
 */
function extractSearchHitsFromGeminiResponse(json: GeminiGenerateResponse): Array<{ url: string; title: string; snippet: string }> {
  const out: Array<{ url: string; title: string; snippet: string }> = [];
  const seen = new Set<string>();

  const candidates = json.candidates ?? [];
  for (const cand of candidates) {
    const gm = pickGroundingMetadata(cand);
    const chunks = normalizeChunks(gm);

    for (const ch of chunks) {
      const hit = hitFromChunk(ch);
      if (!hit || seen.has(hit.url)) continue;
      seen.add(hit.url);
      out.push(hit);
    }

    const supports = normalizeSupports(gm);
    for (const sup of supports) {
      const idxs = sup.groundingChunkIndices ?? sup.grounding_chunk_indices ?? [];
      for (const i of idxs) {
        const ch = chunks[i];
        if (!ch) continue;
        const hit = hitFromChunk(ch);
        if (!hit || seen.has(hit.url)) continue;
        seen.add(hit.url);
        out.push(hit);
      }
    }
  }

  if (out.length > 0) {
    return out;
  }

  for (const cand of candidates) {
    const parts = cand?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("\n");
    if (!text) continue;
    for (const url of extractUrlsFromModelText(text)) {
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, title: url, snippet: url });
      if (out.length >= 12) break;
    }
    if (out.length >= 12) break;
  }

  return out;
}

/**
 * Grounded web discovery: collects grounding chunk URLs/titles from Gemini + Google Search.
 * Prompt asks for a minimal Bulgarian-context answer so the model runs search.
 */
export async function geminiGroundedSearchHits(searchQuery: string): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const prompt = [
    "Ти си асистент за откриване на български фестивали и културни събития.",
    "Задължително използвай Google Search (инструментът за търсене) за актуални уеб резултати. Не отговаряй само от памет.",
    "Намери релевантни уеб страници (официални сайтове, общини, туризъм, медии, Facebook събития).",
    `Заявка за търсене: ${searchQuery}`,
    "Отговори накратко (1–3 изречения) на български; в текста споменавай домейни/източници, които намираш чрез търсенето.",
  ].join("\n");

  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [
        {
          text: "Винаги използвай наличното Google Search заявяване, за да намериш реални страници. Цитирай намерените източници.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const json = await postGenerateContent(body);
  logGeminiSearchDebug("raw response", json);

  const out = extractSearchHitsFromGeminiResponse(json);
  logGeminiSearchDebug("extracted hits", { count: out.length, urls: out.map((h) => h.url) });

  return out;
}

export type GeminiJsonExtractOptions = {
  systemInstruction: string;
  userText: string;
  /** Optional JSON schema (Gemini structured output); omitted uses JSON mode only. */
  responseSchema?: Record<string, unknown>;
};

/**
 * Structured JSON extraction (no web grounding). Uses responseMimeType application/json.
 */
export async function geminiExtractJson<T>(options: GeminiJsonExtractOptions): Promise<T> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1,
    topP: 0.95,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
  };
  if (options.responseSchema) {
    generationConfig.responseSchema = options.responseSchema;
  }

  const body = {
    systemInstruction: { parts: [{ text: options.systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: options.userText }] }],
    generationConfig,
  };

  const json = await postGenerateContent(body);
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
