"use client";

import { hasActivePromotion } from "@/lib/monetization";

function formatPromotionExpiry(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });
}

export type AdminMonetizationSummaryCardProps = {
  organizerName: string;
  planLabel?: string | null;
  gallerySlots?: { used: number; limit: number } | null;
  videos?: { used: number; limit: number } | null;
  promotion:
    | {
        status: "normal" | "promoted" | null | undefined;
        expiresAtInput?: string | null | undefined;
      }
    | {
        status?: "normal" | "promoted" | null;
        expiresAtInput?: string | null | undefined;
      };
};

/**
 * Compact secondary context for admin festival editors: organizer plan, media caps vs usage, promotion.
 */
export default function AdminMonetizationSummaryCard({
  organizerName,
  planLabel,
  gallerySlots,
  videos,
  promotion,
}: AdminMonetizationSummaryCardProps) {
  const isPromoted = promotion?.status === "promoted";
  const isActive = hasActivePromotion({
    promotion_status: promotion?.status ?? null,
    promotion_expires_at: promotion?.expiresAtInput ?? null,
  });

  const exp = isPromoted ? formatPromotionExpiry(promotion?.expiresAtInput) : null;

  const promotionLine = (() => {
    if (!isPromoted) return "Promotion: not promoted";

    if (isActive) {
      return exp ? `Promotion: promoted · active · expires ${exp}` : "Promotion: promoted · active";
    }

    return exp ? `Promotion: promoted · expired · was due ${exp}` : "Promotion: promoted · expired";
  })();

  const shouldShowPlanAndLimits = Boolean(planLabel && gallerySlots && videos);

  return (
    <aside
      className="rounded-xl border border-black/[0.08] bg-[#fafaf8] px-3 py-2.5 text-[11px] leading-snug text-[#0c0e14]/75"
      aria-label="Plan, media limits, and promotion"
    >
      <p className="font-semibold uppercase tracking-[0.12em] text-[#0c0e14]/45">Plan & limits</p>
      {shouldShowPlanAndLimits ? (
        <>
          <p className="mt-1.5">
            <span className="text-black/45">Organizer:</span>{" "}
            <span className="font-medium text-[#0c0e14]/90">{organizerName || "—"}</span>
            <span className="mx-1.5 text-black/25">·</span>
            <span className="text-black/45">Plan:</span>{" "}
            <span className="font-medium text-[#0c0e14]/90">{planLabel}</span>
          </p>
          <p className="mt-1">
            <span className="text-black/45">Gallery images:</span>{" "}
            <span className="font-mono font-medium tabular-nums text-[#0c0e14]/90">
              {gallerySlots.used}/{gallerySlots.limit}
            </span>
            <span className="mx-1.5 text-black/25">·</span>
            <span className="text-black/45">Videos:</span>{" "}
            <span className="font-mono font-medium tabular-nums text-[#0c0e14]/90">
              {videos.used}/{videos.limit}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-black/70">{organizerName}</p>
      )}
      <p className="mt-1 text-black/70">{promotionLine}</p>
    </aside>
  );
}
