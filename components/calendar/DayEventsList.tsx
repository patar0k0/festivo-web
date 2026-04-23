import Link from "next/link";
import { parseISO } from "date-fns";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { festivalLocationPrimary, festivalLocationSecondary } from "@/lib/settlements/formatDisplayName";
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
            const temporalChip = tState === "past" ? "Отминал" : tState === "ongoing" ? "Текущ" : null;
            return (
            <Link
              key={`${festival.slug}-${festival.id}`}
              href={`/festivals/${festival.slug}`}
              className={cn(
                "block rounded-xl border border-amber-200/35 bg-white p-4 ring-1 ring-amber-100/15 transition hover:border-amber-300/50 hover:shadow-[0_8px_18px_rgba(12,14,20,0.08)]",
                pub.focusRing,
              )}
            >
              <p className="text-base font-semibold text-[#0c0e14]">{festival.title}</p>
              <p className="mt-1 text-sm text-black/60">
                <span>
                  {[festivalLocationPrimary(festival, "").trim(), formatFestivalDateLineShort(festival)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {festivalLocationSecondary(festival) ? (
                  <span className="mt-0.5 block text-[11px] text-black/50">
                    {festivalLocationSecondary(festival)}
                  </span>
                ) : null}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {temporalChip ? (
                  <span className="rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs font-medium text-black/50">
                    {temporalChip}
                  </span>
                ) : null}
                {festival.category ? (
                  <span className="rounded-full border border-black/[0.1] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
                    {festival.category}
                  </span>
                ) : null}
                {festival.is_free ? (
                  <span className="rounded-full border border-emerald-200/70 bg-emerald-50/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-900/85">
                    Безплатно
                  </span>
                ) : null}
              </div>
            </Link>
          );
          })}
        </div>
      )}
    </div>
  );
}

