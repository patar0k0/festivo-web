"use client";

import { ADMIN_ENTITY_TEXTAREA_CLASS } from "@/components/admin/entity";
import {
  ADMIN_LISTING_SHORT_MAX,
  generateShortFromFullDescription,
} from "@/lib/admin/festivalListingShort";

type Props = {
  fullLabel: string;
  shortLabel: string;
  fullValue: string;
  shortValue: string;
  onFullChange: (value: string) => void;
  onShortChange: (value: string) => void;
  previewTitle: string;
  /** Text shown under the short field (e.g. published vs pending storage hint). */
  shortHint?: string;
};

export default function AdminFestivalDescriptionFields({
  fullLabel,
  shortLabel,
  fullValue,
  shortValue,
  onFullChange,
  onShortChange,
  previewTitle,
  shortHint,
}: Props) {
  const shortLen = shortValue.length;
  const overSoft = shortLen > ADMIN_LISTING_SHORT_MAX;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-black/50">{fullLabel}</span>
        <textarea
          value={fullValue}
          onChange={(e) => onFullChange(e.target.value)}
          rows={10}
          className={ADMIN_ENTITY_TEXTAREA_CLASS}
        />
      </label>

      <div>
        <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">{shortLabel}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs tabular-nums ${overSoft ? "font-semibold text-[#b13a1a]" : "text-black/45"}`}>
              {shortLen}/{ADMIN_LISTING_SHORT_MAX}
            </span>
            <button
              type="button"
              onClick={() => onShortChange(generateShortFromFullDescription(fullValue))}
              className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/70 hover:bg-black/[0.03]"
            >
              Генерирай от описанието
            </button>
          </div>
        </div>
        <textarea
          value={shortValue}
          onChange={(e) => onShortChange(e.target.value)}
          rows={4}
          className={ADMIN_ENTITY_TEXTAREA_CLASS}
        />
        {shortHint ? <p className="mt-1.5 text-xs text-black/50">{shortHint}</p> : null}
      </div>

      <details className="rounded-xl border border-black/[0.08] bg-white/80 p-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
          Преглед на карта в списък
        </summary>
        <div className="mt-3 rounded-xl border border-black/[0.08] bg-[#fafafa]/90 p-3 shadow-[0_2px_0_rgba(12,14,20,0.04)]">
          <p className="text-base font-semibold leading-snug text-[#0c0e14]">{previewTitle.trim() || "—"}</p>
          <p
            className="mt-2 text-sm leading-relaxed text-black/65"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {shortValue.trim() || "—"}
          </p>
        </div>
      </details>
    </div>
  );
}
