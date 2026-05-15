// lib/research/serpApiSearch.ts
import "server-only";

export type SerpApiOrganicHit = {
  url: string;
  title: string | null;
  snippet: string | null;
};

type AiOverviewBlock = {
  type: string;
  text?: string;
  items?: unknown[];
};

type SerpApiRawResponse = {
  ai_overview?: {
    text_blocks?: AiOverviewBlock[];
    page_token?: string;
  };
  organic_results?: Array<{ link?: string; title?: string; snippet?: string }>;
  error?: string;
};

export type SerpApiSearchResult = {
  ai_overview_text: string | null;
  organic: SerpApiOrganicHit[];
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

async function fetchSerpApi(params: Record<string, string>): Promise<SerpApiRawResponse> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return {};
  return (await res.json()) as SerpApiRawResponse;
}

export async function serpApiSearch(query: string, hl: "en" | "bg"): Promise<SerpApiSearchResult> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return { ai_overview_text: null, organic: [] };
  if (!query.trim()) return { ai_overview_text: null, organic: [] };

  const json = await fetchSerpApi({ engine: "google", q: query, hl, gl: "bg", api_key: apiKey }).catch(
    () => ({}) as SerpApiRawResponse,
  );

  if (json.error) return { ai_overview_text: null, organic: [] };

  // AI Overview — may need a follow-up page_token request
  let ai_overview_text: string | null = null;
  const blocks = json.ai_overview?.text_blocks;
  if (blocks && blocks.length > 0) {
    const text = blocksToText(blocks);
    if (text) ai_overview_text = text;
  }
  if (!ai_overview_text && json.ai_overview?.page_token) {
    try {
      const json2 = await fetchSerpApi({ engine: "google", page_token: json.ai_overview.page_token, api_key: apiKey });
      const blocks2 = json2.ai_overview?.text_blocks;
      if (blocks2 && blocks2.length > 0) {
        const text = blocksToText(blocks2);
        if (text) ai_overview_text = text;
      }
    } catch {
      // ignore follow-up failure
    }
  }

  // Organic results
  const organic: SerpApiOrganicHit[] = (json.organic_results ?? [])
    .map((r) => ({
      url: (r.link ?? "").trim(),
      title: typeof r.title === "string" ? r.title.trim() : null,
      snippet: typeof r.snippet === "string" ? r.snippet.trim() : null,
    }))
    .filter((r) => r.url.startsWith("http"));

  return { ai_overview_text, organic };
}
