import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { Festival } from "@/lib/types";

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

function formatBadgeDate(start?: string | null) {
  if (!start) return "TBA";
  const date = parseISO(start);
  return format(date, "MMM d");
}

export default function FestivalGrid({ festivals }: { festivals: Festival[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {festivals.map((festival) => (
        <Link key={festival.id} href={`/festival/${festival.slug}`} className="group">
          <div className="rounded-[24px] border border-[color:var(--border2)] bg-[color:var(--surface)] shadow-[var(--shadow2)] transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[var(--shadow)]">
            <div className="relative h-[180px] overflow-hidden rounded-t-[24px] bg-gradient-to-br from-black/5 to-black/3">
              {festival.image_url ? (
                <Image
                  src={festival.image_url}
                  alt={festival.title}
                  fill
                  className="object-cover"
                />
              ) : null}
              <div className="absolute left-3 top-3 rounded-full border border-[color:var(--border2)] bg-white/90 px-3 py-1 text-xs backdrop-blur">
                {formatBadgeDate(festival.start_date)}
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
                {festival.city ?? "Bulgaria"} • {formatDateRange(festival.start_date, festival.end_date)}
              </div>
              <div className="flex flex-wrap gap-2">
                {festival.is_free ? (
                  <span className="rounded-full border border-[color:var(--border2)] bg-[color:var(--surface2)] px-3 py-1 text-xs">
                    Безплатно
                  </span>
                ) : null}
                {festival.category ? (
                  <span className="rounded-full border border-[color:var(--border2)] bg-[color:var(--surface2)] px-3 py-1 text-xs">
                    {festival.category}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
