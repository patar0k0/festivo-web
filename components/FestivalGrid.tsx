import Link from "next/link";
import FallbackImage from "@/components/ui/FallbackImage";
import { format, parseISO } from "date-fns";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { formatFestivalDateLineShort, primaryFestivalDate } from "@/lib/festival/listingDates";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { categoryLabel } from "@/lib/festival/categoryLabel";
import { Festival } from "@/lib/types";

function formatBadgeDate(festival: Festival) {
  const primary = primaryFestivalDate(festival);
  if (!primary) return "TBA";
  const date = parseISO(primary);
  return format(date, "d MMM");
}

export default function FestivalGrid({ festivals }: { festivals: Festival[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {festivals.map((festival) => {
        const heroImage = getFestivalHeroImage(festival);
        const tState = getFestivalTemporalState(festival);
        const temporalChip = tState === "past" ? "Отминал" : tState === "ongoing" ? "Текущ" : null;
        const categoryText = categoryLabel(festival.category);

        return (
        <Link key={festival.id} href={`/festivals/${festival.slug}`} className="group">
          <div className="rounded-[24px] border border-[color:var(--border2)] bg-[color:var(--surface)] shadow-[var(--shadow2)] transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[var(--shadow)]">
            <div className="relative h-[180px] overflow-hidden rounded-t-[24px] bg-gradient-to-br from-black/5 to-black/3">
              {heroImage ? (
                <FallbackImage
                  src={heroImage}
                  alt={festival.title}
                  fill
                  className="object-cover"
                  resetKey={festival.id}
                />
              ) : null}
              <div className="absolute left-3 top-3 rounded-full border border-[color:var(--border2)] bg-white/90 px-3 py-1 text-xs backdrop-blur">
                {formatBadgeDate(festival)}
              </div>
              <button
                type="button"
                className="absolute right-3 top-3 h-9 w-9 rounded-xl border border-[color:var(--border2)] bg-white/90 backdrop-blur"
                aria-label="Bookmark"
              />
            </div>
            <div className="space-y-3 p-5">
              <div className="text-[17px] font-semibold tracking-[-0.2px]">{festival.title}</div>
              <div className="text-sm text-[color:var(--muted)]">
                {[festivalCityLabel(festival, "").trim(), formatFestivalDateLineShort(festival)].filter(Boolean).join(" · ")}
              </div>
              <div className="flex flex-wrap gap-2">
                {temporalChip ? (
                  <span className="rounded-full border border-[color:var(--border2)] bg-[color:var(--surface2)] px-3 py-1 text-xs text-[color:var(--muted)]">
                    {temporalChip}
                  </span>
                ) : null}
                {categoryText ? (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/70">{categoryText}</span>
                ) : null}
              </div>
            </div>
          </div>
        </Link>
        );
      })}
    </div>
  );
}

