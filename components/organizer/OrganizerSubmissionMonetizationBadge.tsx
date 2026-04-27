import { formatBgDateFromIso } from "@/lib/email/formatBg";
import { hasActivePromotion, hasActiveVip, type OrganizerVipStatusRow } from "@/lib/monetization";

export type FestivalPromotionSlice = {
  promotion_status?: string | null;
  promotion_expires_at?: string | null;
};

function formatPromotionEndDate(iso: string | null | undefined): string {
  return formatBgDateFromIso(iso) ?? "—";
}

/** List/card badges: promoted beats VIP; pending submissions pass `festival={null}` so promotion is never shown. */
export default function OrganizerSubmissionMonetizationBadge({
  festival,
  organizer,
}: {
  festival: FestivalPromotionSlice | null;
  organizer: OrganizerVipStatusRow | null;
}) {
  if (festival && hasActivePromotion(festival)) {
    return (
      <span className="inline-block bg-green-100 px-2 py-1 text-xs text-green-700 rounded">
        Промотиран • до {formatPromotionEndDate(festival.promotion_expires_at)}
      </span>
    );
  }

  if (hasActiveVip(organizer)) {
    return <span className="inline-block bg-yellow-100 px-2 py-1 text-xs text-yellow-800 rounded">VIP план активен</span>;
  }

  return null;
}
