import type { ResearchSource } from "@/lib/admin/research/types";
import { extractDomain, normalizeUrl } from "@/lib/admin/research/source-extract";

export type SourceAuthorityTier =
  | "tier1_official"
  | "tier2_reputable"
  | "tier3_reference"
  | "tier4_commercial"
  | "tier5_weak";

const TIER_1_HINTS = ["gov.bg", "municipality", "obshtina", "kmet", "tourism", "visit", "culture", "ministry", "surva", "official"];
const TIER_2_HINTS = ["bta.bg", "bnr.bg", "bnt", "dnevnik", "capital", "offnews", "darik", "news"];
const TIER_4_HINTS = ["eventbrite", "allevents", "tripadvisor", "booking", "tickets", "travel", "blog", "guide"];
const TIER_5_HINTS = ["facebook.com/groups", "facebook.com/pages", "instagram.com", "tiktok.com", "linkedin.com"];

function includesAny(value: string, hints: string[]): boolean {
  return hints.some((hint) => value.includes(hint));
}

function languageSignal(value: string): "bg" | "mixed" | "non_bg" {
  const cyrillic = (value.match(/[\u0400-\u04FF]/g) ?? []).length;
  const latin = (value.match(/[A-Za-z]/g) ?? []).length;
  if (cyrillic > 0 && cyrillic >= latin) return "bg";
  if (cyrillic > 0) return "mixed";
  return "non_bg";
}

export function getSourceAuthorityTier(source: Pick<ResearchSource, "url" | "domain" | "title">): SourceAuthorityTier {
  const scope = `${source.domain} ${source.url} ${source.title}`.toLocaleLowerCase("bg-BG");

  if (includesAny(scope, TIER_1_HINTS)) return "tier1_official";
  if (includesAny(scope, TIER_2_HINTS)) return "tier2_reputable";
  if (scope.includes("wikipedia") || scope.includes("wiki")) return "tier3_reference";
  if (includesAny(scope, TIER_5_HINTS)) return "tier5_weak";
  if (includesAny(scope, TIER_4_HINTS)) return "tier4_commercial";
  return "tier3_reference";
}

const TIER_SCORE: Record<SourceAuthorityTier, number> = {
  tier1_official: 100,
  tier2_reputable: 70,
  tier3_reference: 40,
  tier4_commercial: 15,
  tier5_weak: 0,
};

export function rankSourcesAuthorityFirst(sources: ResearchSource[]): ResearchSource[] {
  const deduped = new Map<string, ResearchSource>();

  for (const source of sources) {
    const normalizedUrl = normalizeUrl(source.url);
    if (!normalizedUrl) continue;
    const domain = extractDomain(normalizedUrl);
    if (!domain) continue;

    const normalized: ResearchSource = {
      ...source,
      url: normalizedUrl,
      domain,
      title: source.title?.trim() || domain,
    };

    const key = `${domain}::${normalized.title.toLocaleLowerCase("bg-BG")}`;
    if (!deduped.has(key)) deduped.set(key, normalized);
  }

  return [...deduped.values()]
    .map((source) => {
      const tier = getSourceAuthorityTier(source);
      const lang = languageSignal(`${source.title} ${source.domain}`);
      return {
        ...source,
        tier,
        language: lang,
        is_official: source.is_official || tier === "tier1_official",
      };
    })
    .sort((a, b) => {
      const tierDelta = TIER_SCORE[b.tier ?? "tier5_weak"] - TIER_SCORE[a.tier ?? "tier5_weak"];
      if (tierDelta !== 0) return tierDelta;
      if ((a.language === "bg") !== (b.language === "bg")) return a.language === "bg" ? -1 : 1;
      return a.domain.localeCompare(b.domain, "bg-BG");
    });
}
