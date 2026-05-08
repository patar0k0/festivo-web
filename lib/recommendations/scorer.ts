import type { Festival } from "@/lib/types";

export type RecommendationInputs = {
  followedOrganizerIds: Set<string>;
  followedCities: Set<string>;
  followedCategories: Set<string>;
  recentlyViewedFestivalIds: Set<string>;
  trendingMax: number;
  nowIsoDate: string;
};

export type RecommendationReason =
  | "because_followed_organizer"
  | "popular_near_you"
  | "trending_in_city"
  | "similar_to_saved";

export type ScoredFestival = {
  festival: Festival;
  score: number;
  reasons: RecommendationReason[];
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function recencyBoostDays(startDate: string, nowIsoDate: string): number {
  const a = Date.parse(`${startDate}T00:00:00.000Z`);
  const b = Date.parse(`${nowIsoDate}T00:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const days = Math.floor((a - b) / 86_400_000);
  if (days < 0) return -0.08;
  if (days <= 3) return 0.22;
  if (days <= 10) return 0.12;
  if (days <= 30) return 0.04;
  return 0;
}

function cityKey(festival: Festival): string {
  return String(festival.city_slug ?? "").trim().toLowerCase();
}

function categoryKey(festival: Festival): string {
  return String(festival.category ?? "").trim().toLowerCase();
}

function organizerId(festival: Festival): string {
  if (festival.organizer_id && String(festival.organizer_id).trim()) {
    return String(festival.organizer_id).trim();
  }
  const nested = (festival.organizer as { id?: string | null } | null)?.id;
  return nested && String(nested).trim() ? String(nested).trim() : "";
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function scoreFestivalForUser(festival: Festival, inputs: RecommendationInputs): ScoredFestival {
  const reasons: RecommendationReason[] = [];
  let score = 0;

  const followedOrg = organizerId(festival);
  if (followedOrg && inputs.followedOrganizerIds.has(followedOrg)) {
    score += 2.5;
    reasons.push("because_followed_organizer");
  }

  const cKey = cityKey(festival);
  if (cKey && inputs.followedCities.has(cKey)) {
    score += 1.4;
    reasons.push("popular_near_you");
  }

  const cat = categoryKey(festival);
  if (cat && inputs.followedCategories.has(cat)) {
    score += 1.15;
    reasons.push("similar_to_saved");
  }

  const rawSaves = toNumber((festival as Festival & { saves_count?: unknown }).saves_count);
  const trendingNorm = inputs.trendingMax > 0 ? Math.min(1, rawSaves / inputs.trendingMax) : 0;
  score += trendingNorm * 1.2;
  if (trendingNorm >= 0.5 && cKey && inputs.followedCities.has(cKey)) {
    reasons.push("trending_in_city");
  }

  if (festival.promotion_status === "promoted") score += 0.45;
  if (festival.is_verified) score += 0.25;
  score += recencyBoostDays(festival.start_date, inputs.nowIsoDate);

  if (inputs.recentlyViewedFestivalIds.has(String(festival.id))) {
    score += 0.35;
  }

  return {
    festival,
    score: round4(score),
    reasons,
  };
}
