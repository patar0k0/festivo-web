import Image from "next/image";
import { format } from "date-fns";
import Badge from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";

type EventCardProps = {
  title: string;
  city?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isFree?: boolean | null;
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
}: EventCardProps) {
  const badge = getDateBadge(startDate);
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/10] bg-neutral-100">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 bg-neutral-100" />
        )}
        <div className="absolute left-4 top-4 rounded-lg bg-orange-500 px-2 py-2 text-center text-white">
          <div className="text-[10px] font-semibold tracking-wide">{badge.month}</div>
          <div className="text-base font-semibold leading-none">{badge.day}</div>
        </div>
        {category ? (
          <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-700">
            {category}
          </div>
        ) : null}
      </div>
      <CardContent className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
          <p className="text-sm text-neutral-600">
            {city ?? "Bulgaria"} • {formatDateRange(startDate, endDate)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isFree ? <Badge variant="primary">Free</Badge> : null}
          {isFree === false ? <Badge variant="neutral">Платено</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}
