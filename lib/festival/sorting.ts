import type { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";
import {
  festivalSortEndKey,
  festivalSortStartKey,
  getFestivalTemporalState,
  temporalListingRank,
} from "@/lib/festival/temporal";
import { endOfDaySofia, nowSofia, toSofiaDate } from "@/lib/utils/timezone";

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
      const now = nowSofia();

      const dateA = toSofiaDate(startDateValue(a));
      const dateB = toSofiaDate(startDateValue(b));

      if (Number.isNaN(dateA.getTime()) && Number.isNaN(dateB.getTime())) return 0;
      if (Number.isNaN(dateA.getTime())) return 1;
      if (Number.isNaN(dateB.getTime())) return -1;

      const endA = a.end_date ? endOfDaySofia(a.end_date) : dateA;
      const endB = b.end_date ? endOfDaySofia(b.end_date) : dateB;

      const isPastA = endA.getTime() < now.getTime();
      const isPastB = endB.getTime() < now.getTime();

      if (isPastA !== isPastB) {
        return isPastA ? 1 : -1;
      }

      const hasDateA = !!a.start_date;
      const hasDateB = !!b.start_date;

      if (hasDateA !== hasDateB) {
        return hasDateA ? -1 : 1;
      }

      const daysA =
        (dateA.getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24);

      const daysB =
        (dateB.getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24);

      const safeDaysA = Math.max(daysA, 0.5);
      const safeDaysB = Math.max(daysB, 0.5);

      const scoreA =
        (a.saves_count ?? 0) / Math.pow(safeDaysA + 1, 1.2);

      const scoreB =
        (b.saves_count ?? 0) / Math.pow(safeDaysB + 1, 1.2);

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
