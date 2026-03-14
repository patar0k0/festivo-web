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

const TIER1_DOMAIN_HINTS = [
  "gov.bg",
  "government.bg",
  "municipality",
  "obshtina",
  "kmet",
  "tourism",
  "visit",
  "culture",
  "festival",
  "fest",
  "surva",
  "carnival",
  "mincult",
  "ministry",
  "edu",
  "org",
];

const TIER1_TITLE_HINTS = ["официал", "official", "организатор", "организира", "община", "министер", "туриз", "култур", "festival"];

const TIER2_DOMAIN_HINTS = ["bta", "bnr", "bnt", "dnevnik", "mediapool", "news", "times", "capital", "offnews", "darik"];
const TIER3_DOMAIN_HINTS = ["wikipedia", "wiki", "britannica", "encyclopedia", "directory", "programata"];
const TIER4_DOMAIN_HINTS = [
  "tripadvisor",
  "booking",
  "expedia",
  "airbnb",
  "agoda",
  "kayak",
  "viator",
  "travel",
  "tour",
  "tickets",
  "eventbrite",
  "allevents",
  "10times",
  "evensi",
  "getyourguide",
];
const TIER5_DOMAIN_HINTS = ["facebook.com/pages", "facebook.com/groups", "instagram.com", "tiktok.com", "linkedin.com", "foursquare"];

const COMMERCIAL_PAGE_HINTS = ["package", "offer", "deal", "book", "booking", "travel guide", "things to do", "attraction", "reseller", "price"];

export type SourceAuthorityTier =
  | "tier1_official"
  | "tier2_reputable"
  | "tier3_reference"
  | "tier4_commercial"
  | "tier5_weak";

export type SourceQualityClass = "strong" | "medium" | "weak";

export type SourceAssessment = {
  score: number;
  isOfficial: boolean;
  qualityClass: SourceQualityClass;
  authorityTier: SourceAuthorityTier;
  languageSignal: "bg" | "mixed" | "non_bg";
  languageScore: number;
};

const BG_STOP_WORDS = [" и ", " за ", " на ", " от ", " в ", " с ", "фестивал", "община", "култура", "туризъм", "организатор"];

function detectPrimaryLanguage(value: string): { signal: "bg" | "mixed" | "non_bg"; score: number } {
  const normalized = ` ${value.toLocaleLowerCase("bg-BG")} `;
  const cyrillic = (normalized.match(/[\u0400-\u04FF]/g) ?? []).length;
  const latin = (normalized.match(/[a-z]/g) ?? []).length;
  const stopWordHits = BG_STOP_WORDS.filter((word) => normalized.includes(word)).length;

  const score = cyrillic * 2 + stopWordHits * 6 - Math.floor(latin / 2);
  if (score >= 12 || (cyrillic > 0 && cyrillic >= latin)) {
    return { signal: "bg", score };
  }
  if (cyrillic > 0) {
    return { signal: "mixed", score };
  }
  return { signal: "non_bg", score };
}

function isBulgarianQuery(query: string): boolean {
  return /[\u0400-\u04FF]/u.test(query) || /\b(фестивал|събор|празник|карнавал|сурва)\b/iu.test(query);
}

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
  const bgQuery = isBulgarianQuery(query);
  const language = detectPrimaryLanguage(`${source.title} ${source.domain}`);

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

  const text = `${title} ${domain}`;
  const isBgDomain = domain.endsWith(".bg");
  const hasInstitutionalSignal = containsAny(domain, TIER1_DOMAIN_HINTS) || containsAny(title, TIER1_TITLE_HINTS) || source.is_official;
  const hasReputableSignal = containsAny(domain, TIER2_DOMAIN_HINTS);
  const isReferenceSignal = containsAny(domain, TIER3_DOMAIN_HINTS) || /\b(wikipedia|reference|encyclopedia|directory)\b/iu.test(text);
  const isCommercialSignal =
    containsAny(text, TIER4_DOMAIN_HINTS) || /\b(travel|tour|booking|package|tickets?|deals?|guide|offer|reseller)\b/iu.test(text);
  const isWeakSignal = containsAny(text, TIER5_DOMAIN_HINTS) || /\b(profile|listing|group|page)\b/iu.test(text);

  let authorityTier: SourceAuthorityTier;
  if (hasInstitutionalSignal && !isCommercialSignal) {
    authorityTier = "tier1_official";
  } else if (hasReputableSignal && !isCommercialSignal) {
    authorityTier = "tier2_reputable";
  } else if (isReferenceSignal && !isCommercialSignal) {
    authorityTier = "tier3_reference";
  } else if (isCommercialSignal) {
    authorityTier = "tier4_commercial";
  } else if (isWeakSignal) {
    authorityTier = "tier5_weak";
  } else {
    authorityTier = "tier5_weak";
  }

  if (isBgDomain && (authorityTier === "tier1_official" || authorityTier === "tier2_reputable")) {
    score += 24;
  }

  if (bgQuery && language.signal === "bg") score += 34;
  if (bgQuery && language.signal === "mixed") score += 12;
  if (bgQuery && language.signal === "non_bg" && authorityTier !== "tier1_official") score -= 28;

  if (bgQuery && authorityTier === "tier4_commercial" && language.signal !== "bg") {
    score -= 45;
  }

  if (containsAny(text, COMMERCIAL_PAGE_HINTS) && authorityTier !== "tier1_official") {
    score -= 70;
  }

  if (authorityTier === "tier1_official") score += 170;
  if (authorityTier === "tier2_reputable") score += 95;
  if (authorityTier === "tier3_reference") score += 35;
  if (authorityTier === "tier4_commercial") score -= 130;
  if (authorityTier === "tier5_weak") score -= 170;

  const qualityClass: SourceQualityClass =
    authorityTier === "tier1_official" || authorityTier === "tier2_reputable"
      ? "strong"
      : authorityTier === "tier3_reference"
        ? "medium"
        : "weak";

  return {
    score,
    isOfficial: isOfficial || authorityTier === "tier1_official",
    qualityClass,
    authorityTier,
    languageSignal: language.signal,
    languageScore: language.score,
  };
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

  const byBaseDomain = new Map<
    string,
    {
      source: ResearchSource;
      score: number;
      isOfficial: boolean;
      authorityTier: SourceAuthorityTier;
      languageSignal: "bg" | "mixed" | "non_bg";
      languageScore: number;
    }
  >();

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
      if (a.authorityTier !== b.authorityTier) {
        const tierRank: Record<SourceAuthorityTier, number> = {
          tier1_official: 1,
          tier2_reputable: 2,
          tier3_reference: 3,
          tier4_commercial: 4,
          tier5_weak: 5,
        };
        return tierRank[a.authorityTier] - tierRank[b.authorityTier];
      }
      if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
      if (a.languageSignal !== b.languageSignal) {
        const langRank = { bg: 1, mixed: 2, non_bg: 3 };
        return langRank[a.languageSignal] - langRank[b.languageSignal];
      }
      if (a.languageScore !== b.languageScore) return b.languageScore - a.languageScore;
      return b.score - a.score;
    })
    .slice(0, limit)
    .map((entry) => ({ ...entry.source, is_official: entry.isOfficial }));
}
