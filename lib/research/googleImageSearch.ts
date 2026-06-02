// lib/research/googleImageSearch.ts
import "server-only";

/**
 * Google Programmable Search (Custom Search JSON API) image search — an optional
 * dedicated image source for the Smart Research pipeline. Unlike SerpAPI's
 * google_images, the CSE API lets us request large photos specifically
 * (`imgSize=large`, `imgType=photo`), which tends to surface real festival
 * covers rather than thumbnails/logos.
 *
 * Optional: skipped (returns []) when GOOGLE_CSE_API_KEY / GOOGLE_CSE_CX are
 * absent, so the pipeline degrades gracefully without it.
 *
 * Quota: 100 queries/day free, then ~$5 per 1000 (max 10 results per call).
 * Docs: https://developers.google.com/custom-search/v1/using_rest
 */

type CseResponse = {
  items?: Array<{ link?: string; mime?: string; image?: { width?: number; height?: number } }>;
  error?: { message?: string };
};

export function isGoogleCseConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY?.trim() && process.env.GOOGLE_CSE_CX?.trim());
}

export async function googleCseImageSearch(query: string, num = 8): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY?.trim();
  const cx = process.env.GOOGLE_CSE_CX?.trim();
  if (!apiKey || !cx || !query.trim()) return [];

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", String(Math.min(Math.max(num, 1), 10)));
  url.searchParams.set("imgSize", "large");
  url.searchParams.set("imgType", "photo");
  url.searchParams.set("gl", "bg");
  url.searchParams.set("hl", "bg");
  url.searchParams.set("safe", "active");

  let json: CseResponse;
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    json = (await res.json().catch(() => ({}))) as CseResponse;
    if (!res.ok || json.error) return [];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of json.items ?? []) {
    const link = typeof item.link === "string" ? item.link.trim() : "";
    if (!link || !/^https?:\/\//i.test(link) || seen.has(link)) continue;
    seen.add(link);
    out.push(link);
  }
  return out;
}
