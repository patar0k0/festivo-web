import Image from "next/image";
import { format } from "date-fns";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

type EventCardProps = {
  title: string;
  city?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isFree?: boolean | null;
  description?: string | null;
  showDetailsButton?: boolean;
  detailsHref?: string;
  showDescription?: boolean;
};

function getDateBadge(date?: string | null) {
  if (!date) return { month: "TBA", day: "--" };
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return { month: "TBA", day: "--" };
  return {
    month: format(parsed, "MMM").toUpperCase(),
    day: format(parsed, "dd"),
  };
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Дата предстои";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "Дата предстои";
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  const endDate = new Date(end);
  return `${format(startDate, "d MMM")} - ${format(endDate, "d MMM yyyy")}`;
}

function categoryLabel(category?: string | null): string | null {
  if (!category) return null;

  const labels: Record<string, string> = {
    music: "Музика",
    folk: "Фолклор",
    arts: "Изкуство",
    food: "Храна",
    cultural: "Култура",
    sports: "Спорт",
    film: "Кино",
    theater: "Театър",
  };

  return labels[category.toLowerCase()] ?? category;
}

export default function EventCard({
  title,
  city,
  category,
  imageUrl,
  startDate,
  endDate,
  isFree,
  description,
  showDetailsButton = false,
  detailsHref,
  showDescription = false,
}: EventCardProps) {
  const badge = getDateBadge(startDate);
  const dateText = formatDateRange(startDate, endDate);
  const locationText = city || "Град: —";
  const snippet = description?.trim();
  const categoryText = categoryLabel(category);

  return (
    <Card className="group overflow-hidden border border-black/[0.09] bg-white/90 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_28px_rgba(12,14,20,0.07)] transition-all duration-200 hover:border-black/[0.16] hover:shadow-[0_2px_0_rgba(12,14,20,0.08),0_20px_42px_rgba(12,14,20,0.13)] focus-within:border-black/[0.16] focus-within:shadow-[0_2px_0_rgba(12,14,20,0.08),0_20px_42px_rgba(12,14,20,0.13)]">
      <div className="relative h-56 bg-black/[0.04]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#f2efe9] text-sm text-black/45">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 5.5C4 4.67 4.67 4 5.5 4h13c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5h-13C4.67 20 4 19.33 4 18.5v-13Z"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path d="M8 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" strokeWidth="1.2" />
              <path d="m4 17 4.5-4.5 3.5 3.5 4.5-4.5L20 15.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            <span>Няма снимка</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

        <div className="absolute left-4 top-4 rounded-lg bg-[#ff4c1f] px-3 py-2 text-center text-white shadow-[0_8px_18px_rgba(255,76,31,0.35)]">
          <div className="text-[10px] font-semibold uppercase tracking-wide">{badge.month}</div>
          <div className="text-base font-bold leading-none">{badge.day}</div>
        </div>

        {categoryText ? (
          <div className="absolute right-4 top-4 rounded-full border border-black/5 bg-white/92 px-3 py-1 text-xs font-semibold text-black/70 backdrop-blur">
            {categoryText}
          </div>
        ) : null}
      </div>

      <CardContent className="space-y-3 p-5">
        <div className="space-y-2">
          <p className="text-sm text-black/55">
            {locationText} • {dateText}
          </p>
          <h3
            className="text-lg font-semibold tracking-tight text-[#0c0e14]"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {title}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFree ? (
            <span className="rounded-full border border-[#ff4c1f]/25 bg-[#ff4c1f]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#ff4c1f]">
              Безплатно
            </span>
          ) : null}
          {isFree === false ? (
            <span className="rounded-full border border-black/[0.1] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
              Платено
            </span>
          ) : null}
        </div>

        {showDescription && snippet ? (
          <p
            className="text-sm text-black/60"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {snippet}
          </p>
        ) : null}

        {showDetailsButton && detailsHref ? (
          <Button
            variant="secondary"
            size="sm"
            href={detailsHref}
            className="border-black/[0.12] bg-white font-semibold text-[#0c0e14] hover:bg-[#f8f7f4]"
          >
            Виж
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
