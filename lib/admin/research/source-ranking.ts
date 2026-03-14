import type { ResearchSource } from "@/lib/admin/research/types";
import { extractDomain, normalizeUrl } from "@/lib/admin/research/source-extract";

const TRUSTED_HOST_HINTS = ["gov", "municipality", "obshtina", "visit", "culture", "tourism", "wikipedia", "bta"];

function hasYearToken(query: string): boolean {
  return /(?:19|20)\d{2}/.test(query);
}

function queryTokens(query: string): string[] {
  return query
    .toLocaleLowerCase("bg-BG")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2 && !/^\d+$/.test(token));
}

function scoreSource(source: ResearchSource, query: string): number {
  const q = query.toLocaleLowerCase("bg-BG");
  const title = source.title.toLocaleLowerCase("bg-BG");
  const domain = source.domain.toLocaleLowerCase("en-US");
  const tokens = queryTokens(query);

  let score = 0;
  if (source.is_official) score += 80;
  if (tokens.some((token) => title.includes(token))) score += 20;
  if (tokens.some((token) => domain.includes(token))) score += 15;
  if (TRUSTED_HOST_HINTS.some((hint) => domain.includes(hint))) score += 8;
  if (title.includes("festival") || title.includes("фестив")) score += 10;
  if (hasYearToken(q) && /(19|20)\d{2}/.test(title)) score += 5;

  return score;
}

export function dedupeAndRankSources(sources: ResearchSource[], query: string, limit = 8): ResearchSource[] {
  const seen = new Set<string>();
  const unique: ResearchSource[] = [];

  for (const source of sources) {
    const normalizedUrl = normalizeUrl(source.url);
    const domain = source.domain || extractDomain(source.url);
    const key = `${domain}|${normalizedUrl}`;
    if (!domain || seen.has(key)) continue;

    seen.add(key);
    unique.push({
      ...source,
      domain,
      url: normalizedUrl,
      title: source.title.trim() || source.url,
    });
  }

  return unique
    .map((source) => ({ source, score: scoreSource(source, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.source);
}
