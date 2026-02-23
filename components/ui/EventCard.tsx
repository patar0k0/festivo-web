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
  if (!start) return "Dates TBA";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "Dates TBA";
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  const endDate = new Date(end);
  return `${format(startDate, "d MMM")} - ${format(endDate, "d MMM yyyy")}`;
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
}: EventCardProps) {
  const badge = getDateBadge(startDate);
  const dateText = formatDateRange(startDate, endDate);
  const locationText = city ? city : "Град: —";
  const snippet = description?.trim();
  return (
    <Card className="group overflow-hidden transition-all duration-200 hover:shadow-lg">
      <div className="relative h-52 bg-neutral-100 transition-transform duration-200 group-hover:scale-[1.02]">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-sm text-neutral-500">
            No image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute left-4 top-4 rounded-lg bg-orange-500 px-3 py-2 text-center text-white">
          <div className="text-[10px] font-semibold uppercase tracking-wide">{badge.month}</div>
          <div className="text-base font-bold leading-none">{badge.day}</div>
        </div>
        {category ? (
          <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs text-neutral-700">
            {category}
          </div>
        ) : null}
      </div>
      <CardContent className="space-y-2 p-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-neutral-900">{title}</h3>
          <p className="mt-1 text-sm text-neutral-500">
            {locationText} • {dateText === "Dates TBA" ? "Дата: предстои" : dateText}
          </p>
        </div>
        {snippet ? (
          <p
            className="text-sm text-neutral-600"
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {snippet}
          </p>
        ) : null}
        {isFree ? <span className="text-sm font-medium text-orange-500">Free</span> : null}
        {isFree === false ? <span className="text-sm font-medium text-neutral-600">Платено</span> : null}
        {showDetailsButton && detailsHref ? (
          <Button variant="secondary" size="sm" href={detailsHref}>
            Details
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
