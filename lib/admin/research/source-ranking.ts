import type { ResearchSource } from "@/lib/admin/research/types";
import { extractDomain, normalizeUrl } from "@/lib/admin/research/source-extract";

const OFFICIAL_HINTS = ["official", "официал", "festival", "fest", "surva", "carnival"];
const INSTITUTIONAL_HINTS = ["gov", "gob", "municipality", "obshtina", "council", "culture", "tourism", "visit", "edu", "org"];
const TRUSTED_MEDIA_HINTS = ["bta", "bnr", "bnt", "dnevnik", "mediapool", "news", "times"];
const LOW_QUALITY_HINTS = ["wiki", "wikipedia", "facebook.com/events", "eventbrite", "allevents", "festivall", "events.bg", "directory", "tripadvisor", "couchsurfing", "listing", "profile", "things to do"];
const STRONG_DOMAIN_HINTS = [
  "gov.bg",
  "government",
  "municipality",
  "obshtina",
  "visit",
  "tourism",
  "culture",
  "festival",
  "fest",
  "surva",
  "bta.bg",
  "bnr.bg",
  "bntnews.bg",
  "programata.bg",
];
const WEAK_DOMAIN_HINTS = [
  "tripadvisor",
  "couchsurfing",
  "eventbrite",
  "allevents",
  "eventsin",
  "10times",
  "evensi",
  "facebook.com/pages",
  "facebook.com/groups",
  "facebook.com/public",
  "instagram.com",
  "tiktok.com",
  "linkedin.com",
  "foursquare",
  "booking",
  "trip",
];

export type SourceQualityClass = "strong" | "medium" | "weak";

export type SourceAssessment = {
  score: number;
  isOfficial: boolean;
  qualityClass: SourceQualityClass;
};

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase("bg-BG")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((part) => part.length > 2);
}

function baseDomain(hostname: string): string {
  const parts = hostname.toLocaleLowerCase("en-US").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  return parts.slice(-2).join(".");
}

function containsAny(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

function classifySource(source: ResearchSource, query: string): SourceAssessment {
  const title = source.title.toLocaleLowerCase("bg-BG");
  const domain = source.domain.toLocaleLowerCase("en-US");
  const queryTokens = tokenize(query);

  let score = 0;
  let isOfficial = source.is_official;

  const tokenHits = queryTokens.filter((token) => title.includes(token) || domain.includes(token)).length;
  if (tokenHits > 0) score += Math.min(26, tokenHits * 8);

  if (containsAny(`${title} ${domain}`, OFFICIAL_HINTS)) {
    score += 30;
    isOfficial = true;
  }

  if (containsAny(domain, INSTITUTIONAL_HINTS)) {
    score += 18;
  }

  if (containsAny(domain, TRUSTED_MEDIA_HINTS)) {
    score += 8;
  }

  if (containsAny(`${title} ${domain}`, LOW_QUALITY_HINTS)) {
    score -= 18;
  }

  if (source.is_official) score += 25;

  if (containsAny(domain, STRONG_DOMAIN_HINTS) || /\b(община|municipality|tourism|култур[аеи])\b/iu.test(title)) {
    score += 28;
    isOfficial = true;
  }

  if (containsAny(`${title} ${domain}`, WEAK_DOMAIN_HINTS) || /\b(listing|directory|things to do|attractions?)\b/iu.test(title)) {
    score -= 42;
  }

  const qualityClass: SourceQualityClass = score >= 52 || isOfficial ? "strong" : score >= 22 ? "medium" : "weak";

  return { score, isOfficial, qualityClass };
}

export function assessSourceQuality(source: ResearchSource, query: string): SourceAssessment {
  return classifySource(source, query);
}

export function dedupeAndRankSources(sources: ResearchSource[], query: string, limit = 8): ResearchSource[] {
  const uniqueByUrl = new Map<string, ResearchSource>();

  for (const source of sources) {
    const normalizedUrl = normalizeUrl(source.url);
    const domain = source.domain || extractDomain(source.url);
    if (!normalizedUrl || !domain) continue;

    const key = normalizedUrl.toLocaleLowerCase("en-US");
    if (!uniqueByUrl.has(key)) {
      uniqueByUrl.set(key, {
        ...source,
        url: normalizedUrl,
        domain,
        title: source.title.trim() || normalizedUrl,
      });
    }
  }

  const byBaseDomain = new Map<string, { source: ResearchSource; score: number; isOfficial: boolean }>();

  for (const source of uniqueByUrl.values()) {
    const classification = classifySource(source, query);
    const domainGroup = baseDomain(source.domain);
    const existing = byBaseDomain.get(domainGroup);

    if (!existing || classification.score > existing.score) {
      byBaseDomain.set(domainGroup, { source, ...classification });
    }
  }

  return [...byBaseDomain.values()]
    .sort((a, b) => {
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, limit)
    .map((entry) => ({ ...entry.source, is_official: entry.isOfficial }));
}
