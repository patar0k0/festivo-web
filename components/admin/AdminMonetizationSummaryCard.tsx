"use client";

function formatPromotionExpiry(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("bg-BG", { dateStyle: "medium", timeStyle: "short" });
}

export type AdminMonetizationSummaryCardProps = {
  organizerName: string;
  planLabel: string;
  gallerySlots: { used: number; limit: number };
  videos: { used: number; limit: number };
  promotion:
    | {
        scope: "published";
        status: "normal" | "promoted";
        expiresAtInput: string | null | undefined;
      }
    | { scope: "pending" };
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
  const promotionLine =
    promotion.scope === "pending"
      ? "Promotion: not on catalog yet — set on the published festival after approval"
      : promotion.status === "promoted"
        ? (() => {
            const exp = formatPromotionExpiry(promotion.expiresAtInput);
            return exp ? `Promotion: active · expires ${exp}` : "Promotion: active (no expiry date)";
          })()
        : "Promotion: not active";

  return (
    <aside
      className="rounded-xl border border-black/[0.08] bg-[#fafaf8] px-3 py-2.5 text-[11px] leading-snug text-[#0c0e14]/75"
      aria-label="Plan, media limits, and promotion"
    >
      <p className="font-semibold uppercase tracking-[0.12em] text-[#0c0e14]/45">Plan & limits</p>
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
      <p className="mt-1 text-black/70">{promotionLine}</p>
    </aside>
  );
}
