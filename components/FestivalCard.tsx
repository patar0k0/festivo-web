import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Festival } from "@/lib/types";
import { Card, CardBody, CardMedia } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

export default function FestivalCard({ festival }: { festival: Festival }) {
  const hasImage = Boolean(festival.hero_image || festival.cover_image);
  const description = festival.description ?? "";

  return (
    <Link href={`/festival/${festival.slug}`} className="group">
      <Card className="h-full transition hover:-translate-y-1">
        {hasImage ? (
          <CardMedia className="h-48">
            <Image
              src={festival.hero_image ?? festival.cover_image ?? "/hero.svg"}
              alt={festival.title}
              fill
              className="object-cover"
            />
          </CardMedia>
        ) : null}
        <CardBody className="space-y-3">
          <Text variant="muted" size="sm">
            {festival.city ?? "Bulgaria"} · {formatDateRange(festival.start_date, festival.end_date)}
          </Text>
          <Heading as="h3" size="h3" className="text-lg">
            {festival.title}
          </Heading>
          <div className="flex flex-wrap gap-2">
            {festival.is_free ? <Badge variant="free">Free</Badge> : null}
            {festival.category ? <Badge variant="category">{festival.category}</Badge> : null}
          </div>
          {description ? (
            <p
              className="text-sm text-muted"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {description}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </Link>
  );
}
