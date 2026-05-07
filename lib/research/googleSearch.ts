export type GoogleSearchOrganicHit = {
  url: string;
  title: string | null;
  snippet: string | null;
};

type SerpOrganicRow = {
  link?: string;
  title?: string;
  snippet?: string;
};

/**
 * Google web results via SerpAPI (https://serpapi.com/). Requires `SERPAPI_KEY`.
 */
export async function googleSearch(query: string): Promise<GoogleSearchOrganicHit[]> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "bg");
  url.searchParams.set("gl", "bg");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  const json = (await res.json()) as { organic_results?: SerpOrganicRow[]; error?: string };

  if (!res.ok) {
    console.warn("[googleSearch] SerpAPI HTTP error", res.status, json?.error);
    return [];
  }
  if (json.error) {
    console.warn("[googleSearch] SerpAPI error", json.error);
    return [];
  }

  const rows = json.organic_results ?? [];
  const out: GoogleSearchOrganicHit[] = [];
  for (const r of rows) {
    const link = typeof r.link === "string" ? r.link.trim() : "";
    if (!link) continue;
    out.push({
      url: link,
      title: typeof r.title === "string" ? r.title : null,
      snippet: typeof r.snippet === "string" ? r.snippet : null,
    });
  }
  return out;
}
