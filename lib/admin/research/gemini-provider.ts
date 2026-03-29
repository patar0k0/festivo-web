/**
 * Server-only Gemini REST client (generateContent). Grounding uses the google_search tool.
 * Env: GEMINI_API_KEY (or GOOGLE_AI_API_KEY). Optional: GEMINI_RESEARCH_MODEL (default gemini-2.0-flash).
 */

const DEFAULT_MODEL = process.env.GEMINI_RESEARCH_MODEL?.trim() || "gemini-2.0-flash";
const DEFAULT_TIMEOUT_MS = Math.min(Math.max(Number.parseInt(process.env.GEMINI_RESEARCH_TIMEOUT_MS ?? "120000", 10) || 120_000, 15_000), 180_000);

export type GeminiGroundingChunk = {
  web?: { uri?: string; title?: string };
};

export type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      webSearchQueries?: string[];
      groundingChunks?: GeminiGroundingChunk[];
      groundingSupports?: unknown[];
    };
  }>;
  error?: { message?: string; code?: number };
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
 * Grounded web discovery: collects grounding chunk URLs/titles from Gemini + Google Search.
 * Prompt asks for a minimal Bulgarian-context answer so the model runs search.
 */
export async function geminiGroundedSearchHits(searchQuery: string): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const prompt = [
    "Ти си асистент за откриване на български фестивали и културни събития.",
    "Намери релевантни уеб страници (официални сайтове, общини, медии, Facebook събития).",
    `Заявка за търсене: ${searchQuery}`,
    "Отговори с 1–2 изречения на български с фактите; цитирай източниците от търсенето.",
  ].join("\n");

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  };

  const json = await postGenerateContent(body);
  const chunks = json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const out: Array<{ url: string; title: string; snippet: string }> = [];
  const seen = new Set<string>();

  for (const ch of chunks) {
    const uri = ch.web?.uri?.trim();
    if (!uri || !uri.startsWith("http")) continue;
    if (seen.has(uri)) continue;
    seen.add(uri);
    const title = (ch.web?.title ?? "").trim() || uri;
    out.push({ url: uri, title, snippet: title });
  }

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
