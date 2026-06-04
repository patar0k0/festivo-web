// lib/research/serpApiSearch.ts
import "server-only";
import {
  getActiveSerpApiKeyIndex,
  resolveSerpApiKey,
  setActiveSerpApiKeyIndex,
  type SerpApiKeyIndex,
} from "@/lib/admin/serpApiConfig.server";

export type SerpApiOrganicHit = {
  url: string;
  title: string | null;
  snippet: string | null;
  /** Per-result thumbnail Google chose to show next to the snippet. Often small. */
  thumbnail: string | null;
};

type AiOverviewBlock = {
  type: string;
  text?: string;
  items?: unknown[];
};

type SerpApiInlineImage = {
  link?: string;
  original?: string;
  thumbnail?: string;
  source?: string;
};

type SerpApiKnowledgeGraph = {
  image?: string;
  thumbnail?: string;
  header_images?: Array<{ image?: string; source?: string }>;
};

type SerpApiTopStory = {
  link?: string;
  title?: string;
  thumbnail?: string;
};

/**
 * engine=google_ai_mode block. The synthesized answer is exposed both as
 * `reconstructed_markdown` (whole answer) and as structured `text_blocks`
 * (paragraphs use `snippet`, lists nest items under `list[].snippet`). We prefer
 * the markdown and fall back to walking the blocks.
 */
type AiModeTextBlock = {
  type?: string;
  snippet?: string;
  list?: Array<{ snippet?: string; title?: string }>;
};

type SerpApiReference = {
  title?: string;
  link?: string;
  snippet?: string;
  source?: string;
  thumbnail?: string;
};

type SerpApiRawResponse = {
  ai_overview?: {
    text_blocks?: AiOverviewBlock[];
    page_token?: string;
  };
  /** engine=google_ai_mode top-level fields */
  reconstructed_markdown?: string;
  text_blocks?: AiModeTextBlock[];
  references?: SerpApiReference[];
  search_metadata?: { status?: string };
  organic_results?: Array<{
    link?: string;
    title?: string;
    snippet?: string;
    thumbnail?: string;
  }>;
  inline_images?: SerpApiInlineImage[];
  knowledge_graph?: SerpApiKnowledgeGraph;
  top_stories?: SerpApiTopStory[];
  /** engine=google_images response shape */
  images_results?: Array<{
    thumbnail?: string;
    original?: string;
    link?: string;
    source?: string;
  }>;
  error?: string;
};

export type SerpApiSearchResult = {
  ai_overview_text: string | null;
  organic: SerpApiOrganicHit[];
  /**
   * Image URLs discovered in the search response itself — inline_images,
   * knowledge_graph image/header_images, top_stories thumbnails, plus
   * organic_results thumbnails as a last resort.
   *
   * Ordered by reliability: high-res inline/knowledge_graph first, then
   * smaller thumbnails. All absolute http(s) URLs.
   */
  image_urls: string[];
  /**
   * Human-readable diagnostic surfaced to the admin panel when something went
   * wrong (quota exhausted, all keys failed, automatic failover happened).
   * `null` on a clean run.
   */
  warning: string | null;
};

function blocksToText(blocks: AiOverviewBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (typeof b.text === "string" && b.text.trim()) lines.push(b.text.trim());
    if (Array.isArray(b.items)) {
      for (const item of b.items) {
        if (typeof item === "string" && item.trim()) lines.push(`- ${item.trim()}`);
        if (item && typeof item === "object" && "text" in item && typeof (item as { text?: string }).text === "string") {
          const t = ((item as { text: string }).text).trim();
          if (t) lines.push(`- ${t}`);
        }
      }
    }
  }
  return lines.join("\n");
}

/** Builds plain text from an AI Mode response — prefers the whole-answer markdown. */
function aiModeToText(json: SerpApiRawResponse): string | null {
  if (typeof json.reconstructed_markdown === "string" && json.reconstructed_markdown.trim()) {
    return json.reconstructed_markdown.trim();
  }
  const blocks = json.text_blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) return null;
  const lines: string[] = [];
  for (const b of blocks) {
    if (typeof b.snippet === "string" && b.snippet.trim()) lines.push(b.snippet.trim());
    if (Array.isArray(b.list)) {
      for (const item of b.list) {
        const t = typeof item?.snippet === "string" ? item.snippet.trim() : "";
        if (t) lines.push(`- ${t}`);
      }
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Maps AI Mode `references` (cited sources) into organic-hit shape for fetching + sourcing. */
function referencesToHits(json: SerpApiRawResponse): SerpApiOrganicHit[] {
  if (!Array.isArray(json.references)) return [];
  return json.references
    .map((r) => ({
      url: (r.link ?? "").trim(),
      title: typeof r.title === "string" && r.title.trim() ? r.title.trim() : (typeof r.source === "string" ? r.source.trim() : null),
      snippet: typeof r.snippet === "string" ? r.snippet.trim() : null,
      thumbnail: typeof r.thumbnail === "string" ? r.thumbnail.trim() : null,
    }))
    .filter((r) => r.url.startsWith("http"));
}

function pushHttpUrl(out: string[], seen: Set<string>, raw: string | undefined | null): void {
  if (typeof raw !== "string") return;
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (!/^https?:\/\//i.test(trimmed)) return;
  if (seen.has(trimmed)) return;
  seen.add(trimmed);
  out.push(trimmed);
}

function collectImageUrls(json: SerpApiRawResponse): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  // Knowledge graph — typically decent-quality entity images
  const kg = json.knowledge_graph;
  if (kg) {
    pushHttpUrl(out, seen, kg.image);
    pushHttpUrl(out, seen, kg.thumbnail);
    if (Array.isArray(kg.header_images)) {
      for (const h of kg.header_images) pushHttpUrl(out, seen, h?.image);
    }
  }

  // inline_images: only `original` (high-res from source site).
  // `thumbnail` (Google gstatic, ~256px) is excluded — too small for hero use.
  if (Array.isArray(json.inline_images)) {
    for (const img of json.inline_images) {
      pushHttpUrl(out, seen, img.original);
    }
  }

  // engine=google_images: only `original`; thumbnails are gstatic-proxied small copies.
  if (Array.isArray(json.images_results)) {
    for (const img of json.images_results) {
      pushHttpUrl(out, seen, img.original);
    }
  }

  // top_stories and organic thumbnails excluded — these are icon-sized (≤128px).

  return out;
}

async function fetchSerpApi(params: Record<string, string>, timeoutMs = 10_000): Promise<SerpApiRawResponse> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs) });
  // Parse the body even on non-2xx: SerpAPI returns the quota / auth reason in a
  // JSON `error` field with a 401/429 status. Swallowing it (returning {}) would
  // hide the exact condition automatic failover needs to detect.
  try {
    const json = (await res.json()) as SerpApiRawResponse;
    if (!res.ok && !json.error) {
      return { error: `SerpAPI HTTP ${res.status}` };
    }
    return json;
  } catch {
    return res.ok ? {} : { error: `SerpAPI HTTP ${res.status}` };
  }
}

/** Quota / rate-limit / plan-exhausted errors that warrant trying the other key. */
function isQuotaError(error: string | undefined): boolean {
  if (!error) return false;
  return /run out|exceed|limit|quota|exhaust|plan|429/i.test(error);
}

type SerpFetchOutcome = {
  json: SerpApiRawResponse;
  failedOver: boolean;
  /** Set when both keys are unusable (quota or missing). */
  fatalError: string | null;
};

/**
 * Fetches from SerpAPI using the configured active key, automatically retrying
 * with the alternate key on a quota/rate error. On a successful failover the
 * working key is persisted so subsequent calls (this run and future searches)
 * use it without manual toggling.
 */
async function fetchSerpApiWithFailover(
  buildParams: (apiKey: string) => Record<string, string>,
  timeoutMs = 10_000,
): Promise<SerpFetchOutcome> {
  const primaryIndex = await getActiveSerpApiKeyIndex();
  const altIndex: SerpApiKeyIndex = primaryIndex === "1" ? "2" : "1";
  const order: SerpApiKeyIndex[] = [primaryIndex, altIndex];

  let failedOver = false;
  let lastError: string | null = null;

  for (let i = 0; i < order.length; i++) {
    const idx = order[i]!;
    const apiKey = resolveSerpApiKey(idx);
    if (!apiKey) {
      lastError = `SerpAPI ключ ${idx} липсва`;
      continue;
    }

    const json = await fetchSerpApi(buildParams(apiKey), timeoutMs).catch(
      () => ({ error: "SerpAPI заявка неуспешна (timeout)" }) as SerpApiRawResponse,
    );

    if (json.error && isQuotaError(json.error) && i < order.length - 1) {
      // Quota hit on this key — try the alternate.
      lastError = json.error;
      failedOver = true;
      continue;
    }

    if (failedOver && !json.error) {
      // Alternate key worked — make it the active one going forward.
      try {
        await setActiveSerpApiKeyIndex(idx);
        console.warn(`[serpapi] auto-failover → ключ ${idx} (предишният изчерпан: ${lastError})`);
      } catch {
        // Persistence failure is non-fatal; the call still succeeded.
      }
    }

    return { json, failedOver, fatalError: json.error ?? null };
  }

  return { json: {}, failedOver, fatalError: lastError ?? "SerpAPI недостъпен" };
}

export async function serpApiSearch(query: string, hl: "en" | "bg"): Promise<SerpApiSearchResult> {
  const empty = (warning: string | null): SerpApiSearchResult => ({
    ai_overview_text: null,
    organic: [],
    image_urls: [],
    warning,
  });
  if (!query.trim()) return empty(null);

  const { json, failedOver, fatalError } = await fetchSerpApiWithFailover((apiKey) => ({
    engine: "google",
    q: query,
    hl,
    gl: "bg",
    api_key: apiKey,
  }));

  if (json.error || fatalError) {
    const reason = json.error ?? fatalError;
    return empty(`SerpAPI грешка: ${reason}`);
  }

  const failoverNote = failedOver ? "SerpAPI: автоматично превключен на резервен ключ." : null;

  // AI Overview — may need a follow-up page_token request
  let ai_overview_text: string | null = null;
  const blocks = json.ai_overview?.text_blocks;
  if (blocks && blocks.length > 0) {
    const text = blocksToText(blocks);
    if (text) ai_overview_text = text;
  }
  if (!ai_overview_text && json.ai_overview?.page_token) {
    // Resolve the now-active key (failover already settled which one works).
    const followupKey = resolveSerpApiKey(await getActiveSerpApiKeyIndex());
    if (followupKey) {
      try {
        const json2 = await fetchSerpApi({ engine: "google", page_token: json.ai_overview.page_token, api_key: followupKey });
        const blocks2 = json2.ai_overview?.text_blocks;
        if (blocks2 && blocks2.length > 0) {
          const text = blocksToText(blocks2);
          if (text) ai_overview_text = text;
        }
      } catch {
        // ignore follow-up failure
      }
    }
  }

  // Organic results
  const organic: SerpApiOrganicHit[] = (json.organic_results ?? [])
    .map((r) => ({
      url: (r.link ?? "").trim(),
      title: typeof r.title === "string" ? r.title.trim() : null,
      snippet: typeof r.snippet === "string" ? r.snippet.trim() : null,
      thumbnail: typeof r.thumbnail === "string" ? r.thumbnail.trim() : null,
    }))
    .filter((r) => r.url.startsWith("http"));

  return { ai_overview_text, organic, image_urls: collectImageUrls(json), warning: failoverNote };
}

export type SerpApiAiModeResult = {
  /** Synthesized Gemini answer (the "Режим с AI" box). The strongest evidence source. */
  ai_mode_text: string | null;
  /** Sources Google cited under the AI answer — fed into fetching + the sources list. */
  references: SerpApiOrganicHit[];
  /** Inline images + reference thumbnails discovered in the AI Mode response. */
  image_urls: string[];
  warning: string | null;
};

/**
 * engine=google_ai_mode — taps Google's Gemini-powered AI Mode synthesis, which
 * aggregates many sources (official .bg sites, news) into a single dated answer.
 * This is far richer than the legacy `ai_overview` box and is often present for
 * niche/future BG festivals where `ai_overview` is empty. Synchronous but slower
 * than a regular search, so we allow a longer timeout. Costs 1 SerpAPI credit.
 */
export async function serpApiAiMode(query: string): Promise<SerpApiAiModeResult> {
  const empty = (warning: string | null): SerpApiAiModeResult => ({
    ai_mode_text: null,
    references: [],
    image_urls: [],
    warning,
  });
  if (!query.trim()) return empty(null);

  const { json, failedOver, fatalError } = await fetchSerpApiWithFailover(
    (apiKey) => ({ engine: "google_ai_mode", q: query, hl: "bg", gl: "bg", api_key: apiKey }),
    15_000,
  );

  if (json.error || fatalError) {
    return empty(`SerpAPI AI Mode грешка: ${json.error ?? fatalError}`);
  }

  return {
    ai_mode_text: aiModeToText(json),
    references: referencesToHits(json),
    image_urls: collectImageUrls(json),
    warning: failedOver ? "SerpAPI: автоматично превключен на резервен ключ (AI Mode)." : null,
  };
}

/**
 * Dedicated Google Images search — used as a last-resort fallback when the
 * regular search response + page-level og:image extraction yield zero images.
 * Costs 1 extra SerpAPI call; only fire when we genuinely need it.
 */
export async function serpApiImageSearch(query: string, limit = 5): Promise<string[]> {
  if (!query.trim()) return [];

  const { json } = await fetchSerpApiWithFailover((apiKey) => ({
    engine: "google_images",
    q: query,
    hl: "bg",
    gl: "bg",
    api_key: apiKey,
  }));

  if (json.error) return [];

  const all = collectImageUrls(json);
  return all.slice(0, limit);
}
