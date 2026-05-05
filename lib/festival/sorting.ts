import type { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import {
  festivalSortEndKey,
  festivalSortStartKey,
  getFestivalTemporalState,
  temporalListingRank,
} from "@/lib/festival/temporal";

function vipScore(festival: Festival): number {
  return hasActiveVip(festival.organizer) ? 1 : 0;
}

function organizerRank(festival: Festival): number {
  const value = festival.organizer?.organizer_rank;
  return typeof value === "number" ? value : 0;
}

function promotionScore(festival: Festival): number {
  return hasActivePromotion(festival) ? 1 : 0;
}

function promotionRank(festival: Festival): number {
  const value = festival.promotion_rank;
  return typeof value === "number" ? value : 0;
}

function startDateValue(festival: Festival): string {
  return typeof festival.start_date === "string" ? festival.start_date : "9999-12-31";
}

/** Comparator for listing: ongoing → upcoming → past, then monetization, then date keys. */
export function compareFestivalsForListing(a: Festival, b: Festival): number {
  const sa = getFestivalTemporalState(a);
  const sb = getFestivalTemporalState(b);
  const tr = temporalListingRank(sa) - temporalListingRank(sb);
  if (tr !== 0) return tr;

  const byPromotion = promotionScore(b) - promotionScore(a);
  if (byPromotion !== 0) return byPromotion;

  const byPromotionRank = promotionRank(b) - promotionRank(a);
  if (byPromotionRank !== 0) return byPromotionRank;

  const byVip = vipScore(b) - vipScore(a);
  if (byVip !== 0) return byVip;

  const byOrganizerRank = organizerRank(b) - organizerRank(a);
  if (byOrganizerRank !== 0) return byOrganizerRank;

  if (sa === "past" && sb === "past") {
    return festivalSortEndKey(b).localeCompare(festivalSortEndKey(a));
  }
  if (sa === "upcoming" && sb === "upcoming") {
    return festivalSortStartKey(a).localeCompare(festivalSortStartKey(b));
  }
  if (sa === "ongoing" && sb === "ongoing") {
    return festivalSortEndKey(a).localeCompare(festivalSortEndKey(b));
  }

  return startDateValue(a).localeCompare(startDateValue(b));
}

export function sortFestivalsForListing(festivals: Festival[]): Festival[] {
  return [...festivals].sort(compareFestivalsForListing);
}

export type FestivalListingSortMode = "default" | "popular" | "trending";

/** Default mode preserves `sortFestivalsForListing`; popular orders by global `saves_count` then listing tie-breaks. */
export function sortFestivalsForListingWithMode(
  festivals: Festival[],
  mode: FestivalListingSortMode = "default",
): Festival[] {
  if (mode === "trending") {
    return [...festivals].sort((a, b) => {
      const now = new Date();

      const daysA =
        (new Date(startDateValue(a)).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24);

      const daysB =
        (new Date(startDateValue(b)).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24);

      const scoreA =
        (a.saves_count ?? 0) / (Math.max(daysA, 0) + 1);

      const scoreB =
        (b.saves_count ?? 0) / (Math.max(daysB, 0) + 1);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      return compareFestivalsForListing(a, b);
    });
  }
  if (mode === "popular") {
    return [...festivals].sort((a, b) => {
      const ca = a.saves_count ?? 0;
      const cb = b.saves_count ?? 0;
      if (cb !== ca) return cb - ca;
      return compareFestivalsForListing(a, b);
    });
  }
  return sortFestivalsForListing(festivals);
}
