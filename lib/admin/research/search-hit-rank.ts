import type { ResearchSource } from "@/lib/admin/research/types";
import { extractDomain, normalizeUrl } from "@/lib/admin/research/source-extract";
import { getSourceAuthorityTier, type SourceAuthorityTier } from "@/lib/admin/research/source-ranking";

export type SearchHit = {
  url: string;
  title: string;
  snippet: string;
};

const HIGH_OFFICIAL = /\.(bg|gov\.bg)|obshtina|municipality|kmet|tourism|visit|culture|ministry|museum|gallery/i;
const HIGH_FB_EVENT = /facebook\.com\/events\//i;
const HIGH_MEDIA = /bta\.bg|bnr\.bg|bnt\.bg|dnevnik|capital\.bg|offnews|darik|vesti|nova\.bg|bntnews/i;
const LOW_JUNK = /tripadvisor|booking\.com|yelp|timeout\.com\/.*\/things-to-do|allevents|eventbrite|10-те|top\s*\d+|списък|календар\s+на|things to do in/i;
const LIST_PAGE = /(\b10\b|\bтоп\b|\bнай-добрите\b|\blist\b|\bcalendar\b|календар|събития\s+в)/i;

function cyrillicRatio(s: string): number {
  const c = (s.match(/[\u0400-\u04FF]/g) ?? []).length;
  const l = (s.match(/[A-Za-z\u0400-\u04FF]/g) ?? []).length;
  return l === 0 ? 0 : c / l;
}

function titleMatchScore(userQuery: string, title: string): number {
  const q = userQuery
    .toLocaleLowerCase("bg-BG")
    .replace(/\s+/g, " ")
    .trim();
  const t = title.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();
  if (!q || !t) return 0;
  const tokens = q.split(" ").filter((w) => w.length > 2);
  let hits = 0;
  for (const w of tokens) {
    if (t.includes(w)) hits += 1;
  }
  return tokens.length ? (hits / tokens.length) * 40 : 0;
}

function domainBgBonus(host: string): number {
  return host.endsWith(".bg") || host.endsWith(".gov.bg") ? 25 : 0;
}

function tierBaseScore(tier: SourceAuthorityTier): number {
  switch (tier) {
    case "tier1_official":
      return 100;
    case "tier2_reputable":
      return 72;
    case "tier3_reference":
      return 42;
    case "tier4_commercial":
      return 18;
    case "tier5_weak":
      return 8;
    default:
      return 20;
  }
}

/**
 * Ranks search hits; returns top `limit` URLs (default 5) for extraction.
 */
export function rankSearchHits(hits: SearchHit[], userQuery: string, limit = 5): SearchHit[] {
  const scored = hits.map((hit) => {
    const normalized = normalizeUrl(hit.url);
    if (!normalized) return { hit, score: -1e9 };
    let host = "";
    try {
      host = new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return { hit: { ...hit, url: normalized }, score: -1e9 };
    }

    const pseudo: ResearchSource = {
      url: normalized,
      domain: extractDomain(normalized) ?? host,
      title: hit.title,
      is_official: false,
    };
    const tier = getSourceAuthorityTier(pseudo);
    let score = tierBaseScore(tier);

    score += domainBgBonus(host);
    score += titleMatchScore(userQuery, `${hit.title} ${hit.snippet}`);

    if (HIGH_OFFICIAL.test(normalized) || HIGH_OFFICIAL.test(hit.title)) score += 35;
    if (HIGH_FB_EVENT.test(normalized)) score += 28;
    if (HIGH_MEDIA.test(host) || HIGH_MEDIA.test(hit.title)) score += 22;

    if (cyrillicRatio(`${hit.title} ${hit.snippet}`) >= 0.35) score += 12;

    if (LOW_JUNK.test(normalized) || LOW_JUNK.test(hit.title)) score -= 45;
    if (LIST_PAGE.test(hit.title) || LIST_PAGE.test(normalized)) score -= 30;

    return { hit: { ...hit, url: normalized }, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const out: SearchHit[] = [];
  const seen = new Set<string>();
  for (const { hit, score } of scored) {
    if (score < -1e8) continue;
    if (seen.has(hit.url)) continue;
    seen.add(hit.url);
    out.push(hit);
    if (out.length >= limit) break;
  }

  return out;
}
