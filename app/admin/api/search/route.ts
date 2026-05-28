import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { googleSearch } from "@/lib/research/googleSearch";
import { classifyResearchSourceType } from "@/lib/research/htmlFestivalExtract";
import {
  adminPerplexityFestivalSearch,
  normalizeSourceUrl,
  type AdminFestivalSearchHit,
} from "@/lib/research/perplexity";

const GOOD_THRESHOLD = 2;

function mapResearchToAdminSourceType(url: string): AdminFestivalSearchHit["source_type"] {
  const st = classifyResearchSourceType(url);
  if (st === "facebook") return "facebook_event";
  if (st === "listing") return "listing";
  return "article";
}

function adminHitFromUrlRow(
  rawUrl: string,
  title: string | null,
  snippet: string | null,
): AdminFestivalSearchHit | null {
  const canonical = normalizeSourceUrl(rawUrl);
  if (!canonical) return null;
  return {
    url: canonical,
    title,
    snippet,
    source_type: mapResearchToAdminSourceType(canonical),
  };
}

function isGoodResult(r: AdminFestivalSearchHit): boolean {
  const u = r.url.toLowerCase();
  return u.includes(".bg") || u.includes("facebook.com/events") || u.includes("event");
}

function scoreResult(r: AdminFestivalSearchHit, query: string): number {
  let score = 0;

  const u = r.url.toLowerCase();
  const t = (r.title ?? "").toLowerCase();
  const ql = query.toLowerCase();

  if (u.includes("facebook.com/events")) score += 6;
  if (u.includes("eventbg") || u.includes("eventibg")) score += 5;
  if (u.includes(".bg")) score += 4;
  if (u.includes("event")) score += 2;

  if (t.includes("фестивал")) score += 2;

  const firstWord = ql.split(/\s+/)[0] ?? "";
  if (firstWord && t.includes(firstWord)) score += 2;

  if (u.includes(".ru")) score -= 5;
  if (u.includes("blog") || u.includes("article")) score -= 2;

  return score;
}

function urlDedupeKey(url: string): string {
  return (normalizeSourceUrl(url) ?? url).toLowerCase();
}

/** Group by normalized URL, then keep the row with the highest score for that URL. */
function dedupeByUrlPickingBest(hits: AdminFestivalSearchHit[], query: string): AdminFestivalSearchHit[] {
  const grouped = new Map<string, AdminFestivalSearchHit[]>();

  for (const r of hits) {
    const key = urlDedupeKey(r.url);
    const group = grouped.get(key);
    if (group) group.push(r);
    else grouped.set(key, [r]);
  }

  const deduped: AdminFestivalSearchHit[] = [];

  for (const group of grouped.values()) {
    let best = group[0]!;
    let bestScore = scoreResult(best, query);
    for (let i = 1; i < group.length; i++) {
      const row = group[i]!;
      const s = scoreResult(row, query);
      if (s > bestScore) {
        best = row;
        bestScore = s;
      }
    }
    deduped.push(best);
  }

  return deduped;
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  try {
    const { search_results: perplexityResults } = await adminPerplexityFestivalSearch(q);

    let results: AdminFestivalSearchHit[] = [...perplexityResults];

    const goodResults = results.filter(isGoodResult);
    if (goodResults.length < GOOD_THRESHOLD) {
      const boostedQuery = `${q} България фестивал събитие дата място`;
      const googleRows = await googleSearch(boostedQuery);
      const googleHits = googleRows
        .map((row) => adminHitFromUrlRow(row.url, row.title, row.snippet))
        .filter((h): h is AdminFestivalSearchHit => h != null);
      results = [...results, ...googleHits];
    }

    results = dedupeByUrlPickingBest(results, q);

    results = results.filter((r) => {
      const u = r.url.toLowerCase();
      if (
        u.includes(".ru") ||
        u.includes("medium.com") ||
        u.includes("dev.to") ||
        u.includes("github") ||
        u.includes("stackoverflow") ||
        u.includes("docs")
      ) {
        return false;
      }
      return true;
    });

    results.sort((a, b) => scoreResult(b, q) - scoreResult(a, q));

    results = results.slice(0, 8);

    const urls = results.map((h) => h.url);
    return NextResponse.json({ urls, search_results: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    const isConfig = message.includes("PERPLEXITY_API_KEY");
    const isBadInput = message.toLowerCase().includes("query is required");
    return NextResponse.json({ error: message }, { status: isBadInput ? 400 : isConfig ? 503 : 500 });
  }
}
