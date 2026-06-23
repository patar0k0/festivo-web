const BASE_PATH = "/вид-новина/събития-календар/";
const PAGE_QUERY_PARAM = "e-page-2f0f9c7";
const DELAY_BETWEEN_REQUESTS_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches one mc.gov.bg event-calendar list page. Page 1 has no query param;
 * page N>=2 uses ?e-page-2f0f9c7=N (confirmed against the live site during
 * planning — both forms return full server-rendered HTML, no JS execution
 * required). A fixed delay follows every request to avoid hammering the
 * government server.
 */
export async function fetchMcGovListPage(pageNumber: number): Promise<string> {
  const url = new URL(BASE_PATH, "https://mc.government.bg");
  if (pageNumber > 1) {
    url.searchParams.set(PAGE_QUERY_PARAM, String(pageNumber));
  }

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FestivoIngestBot/1.0)" },
  });

  if (!response.ok) {
    throw new Error(`mc.gov.bg page fetch failed: ${response.status} ${url.toString()}`);
  }

  const html = await response.text();
  await delay(DELAY_BETWEEN_REQUESTS_MS);
  return html;
}
