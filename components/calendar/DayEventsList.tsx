import Link from "next/link";
import FallbackImage from "@/components/ui/FallbackImage";
import { parseISO } from "date-fns";
import PlanFestivalBookmark from "@/components/plan/PlanFestivalBookmark";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { Festival } from "@/lib/types";

type DayEventsListProps = {
  day: string;
  festivals: Festival[];
};

export default function DayEventsList({ day, festivals }: DayEventsListProps) {
  const parsedDay = parseISO(day);
  const heading = Number.isNaN(parsedDay.getTime())
    ? day
    : new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" }).format(parsedDay);

  return (
    <div className={cn(pub.panelMuted, "p-4 md:p-5")}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className={cn(pub.sectionTitleMd, "font-bold")}>Събития за {heading}</h2>
        <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-black/60">{festivals.length}</span>
      </div>

      {festivals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[0.1] bg-white/70 px-4 py-8 text-center text-sm text-black/60">
          Няма фестивали за избрания ден.
        </div>
      ) : (
        <div className="space-y-3">
          {festivals.map((festival) => {
            const tState = getFestivalTemporalState(festival);
            // "Сега" replaces the older "Текущ" — clearer, shorter, more colloquial.
            const temporalChip = tState === "past" ? "Отминал" : tState === "ongoing" ? "Сега" : null;
            const heroImage = getFestivalHeroImage(festival);
            const cityName = (getFestivalLocationDisplay(festival).city ?? "").trim();
            const dateLine = formatFestivalDateLineShort(festival);
            const metaLine = [cityName, dateLine].filter(Boolean).join(" · ");
            const detailHref = `/festivals/${festival.slug}`;

            return (
              <article
                key={`${festival.slug}-${festival.id}`}
                className={cn(
                  "rounded-xl border border-amber-200/35 bg-white p-3 ring-1 ring-amber-100/15 transition hover:border-amber-300/50 hover:shadow-[0_8px_18px_rgba(12,14,20,0.08)]",
                )}
              >
                <div className="flex gap-3">
                  {/* Image thumbnail — clickable; falls back to soft brand block when no hero set */}
                  <Link
                    href={detailHref}
                    className={cn(
                      "relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-amber-100/30",
                      pub.focusRing,
                    )}
                    aria-label={`Виж детайли за ${festival.title}`}
                    tabIndex={-1}
                  >
                    {heroImage ? (
                      <FallbackImage
                        src={heroImage}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                        resetKey={festival.id}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-amber-50 text-[#7c2d12]/40">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
                          <path d="M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1zm1 2v9.59l3.3-3.3a1 1 0 011.4 0L14 15.59 16.3 13.3a1 1 0 011.4 0L19 14.59V6H6zm0 12h12v-1.59l-2-2-2.3 2.3a1 1 0 01-1.4 0L9 13.41 6 16.41V18z" />
                        </svg>
                      </div>
                    )}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={detailHref}
                      className={cn("block text-base font-semibold text-[#0c0e14] hover:text-[#7c2d12]", pub.focusRing, "rounded-sm")}
                    >
                      {festival.title}
                    </Link>
                    {metaLine ? <p className="mt-1 text-sm text-black/60">{metaLine}</p> : null}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {temporalChip ? (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em]",
                            tState === "ongoing"
                              ? "bg-[#7c2d12]/10 text-[#7c2d12] ring-1 ring-[#7c2d12]/20"
                              : "bg-black/[0.05] text-black/55",
                          )}
                        >
                          {temporalChip}
                        </span>
                      ) : null}
                      {festival.category ? (
                        <span className="rounded-full border border-black/[0.1] bg-black/[0.03] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-black/65">
                          {festival.category}
                        </span>
                      ) : null}
                      {festival.is_free ? (
                        <span className="rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-emerald-900/85">
                          Безплатно
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Bottom action row — separate interactive elements (no nested links/buttons) */}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-amber-100/40 pt-2">
                  <PlanFestivalBookmark
                    festivalId={String(festival.id)}
                    festival={festival}
                    showProgrammeLink={false}
                    showReminder={false}
                  />
                  <Link
                    href={detailHref}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#0c0e14] transition hover:bg-[#f7f6f3]",
                      pub.focusRing,
                    )}
                  >
                    Детайли →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
