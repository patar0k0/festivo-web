import type { Festival } from "@/lib/types";
import { hasActivePromotion, hasActiveVip } from "@/lib/monetization";

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

export function sortFestivalsForListing(festivals: Festival[]): Festival[] {
  return [...festivals].sort((a, b) => {
    const byPromotion = promotionScore(b) - promotionScore(a);
    if (byPromotion !== 0) return byPromotion;

    const byPromotionRank = promotionRank(b) - promotionRank(a);
    if (byPromotionRank !== 0) return byPromotionRank;

    const byVip = vipScore(b) - vipScore(a);
    if (byVip !== 0) return byVip;

    const byOrganizerRank = organizerRank(b) - organizerRank(a);
    if (byOrganizerRank !== 0) return byOrganizerRank;

    return startDateValue(a).localeCompare(startDateValue(b));
  });
}
