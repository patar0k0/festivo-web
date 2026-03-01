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
  const locationText = city ? city : "Град: —";
  const snippet = description?.trim();
  const categoryText = categoryLabel(category);

  return (
    <Card className="group overflow-hidden border-black/[0.08] bg-white/85 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_28px_rgba(12,14,20,0.07)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_0_rgba(12,14,20,0.08),0_18px_40px_rgba(12,14,20,0.12)]">
      <div className="relative h-52 bg-black/[0.04] transition-transform duration-300 group-hover:scale-[1.02]">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" />
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
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-[#0c0e14]">{title}</h3>
          <p className="mt-1 text-sm text-black/55">
            {locationText} • {dateText}
          </p>
        </div>

        {showDescription && snippet ? (
          <p
            className="text-sm text-black/60"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {snippet}
          </p>
        ) : null}

        {isFree ? <span className="text-sm font-semibold text-[#ff4c1f]">Безплатен</span> : null}
        {isFree === false ? <span className="text-sm font-medium text-black/60">Платен</span> : null}

        {showDetailsButton && detailsHref ? (
          <Button variant="secondary" size="sm" href={detailsHref}>
            Детайли
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
