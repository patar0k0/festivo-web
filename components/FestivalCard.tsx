import Image from "next/image";
import Link from "next/link";
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

export default function FestivalCard({ festival }: { festival: Festival }) {
  const tags = Array.isArray(festival.tags)
    ? festival.tags
    : festival.tags
      ? String(festival.tags).split(",").map((tag) => tag.trim()).filter(Boolean)
      : [];
  return (
    <Link
      href={`/festival/${festival.slug}`}
      className="group overflow-hidden rounded-2xl border border-ink/10 bg-white/80 shadow-soft transition hover:-translate-y-1"
    >
      <div className="relative h-48 w-full">
        <Image
          src={festival.hero_image ?? festival.cover_image ?? "/hero.svg"}
          alt={festival.title}
          fill
          className="object-cover"
        />
        {festival.is_free && (
          <span className="badge absolute left-4 top-4">Free</span>
        )}
      </div>
      <div className="space-y-2 p-5">
        <p className="text-xs uppercase tracking-widest text-muted">
          {formatDateRange(festival.start_date, festival.end_date)}
        </p>
        <h3 className="text-lg font-semibold tracking-tight">
          {festival.title}
        </h3>
        <p className="text-sm text-muted">{festival.city ?? "Bulgaria"}</p>
        {tags.length ? (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-sand px-3 py-1 text-[10px] uppercase tracking-widest">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
