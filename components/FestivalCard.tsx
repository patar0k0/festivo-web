import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Festival } from "@/lib/types";
import { AppleCard, AppleCardBody, AppleCardHeader } from "@/components/apple/AppleCard";
import ApplePill from "@/components/apple/ApplePill";
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
  const hasImage = Boolean(festival.image_url);
  const description = festival.description ?? "";

  return (
    <Link href={`/festival/${festival.slug}`} className="group">
      <AppleCard className="h-full">
        {hasImage ? (
          <AppleCardHeader className="aspect-[16/10] border-b apple-border">
            <Image
              src={festival.image_url ?? "/hero.svg"}
              alt={festival.title}
              fill
              className="object-cover"
            />
          </AppleCardHeader>
        ) : null}
        <AppleCardBody className="space-y-3">
          <Text variant="muted" size="sm">
            {festival.city ?? "Bulgaria"} · {formatDateRange(festival.start_date, festival.end_date)}
          </Text>
          <Heading as="h3" size="h3" className="text-lg">
            {festival.title}
          </Heading>
          <div className="flex flex-wrap gap-2">
            {festival.is_free ? <ApplePill active>Free</ApplePill> : null}
            {festival.category ? <ApplePill>{festival.category}</ApplePill> : null}
          </div>
          {description ? (
            <p
              className="text-sm text-muted"
              style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {description}
            </p>
          ) : null}
        </AppleCardBody>
      </AppleCard>
    </Link>
  );
}
