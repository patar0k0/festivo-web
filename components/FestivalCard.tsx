import FallbackImage from "@/components/ui/FallbackImage";
import Link from "next/link";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { AppleCard, AppleCardBody, AppleCardHeader } from "@/components/apple/AppleCard";
import ApplePill from "@/components/apple/ApplePill";
import Heading from "@/components/ui/Heading";
import Text from "@/components/ui/Text";

export default function FestivalCard({ festival }: { festival: Festival }) {
  const heroImage = getFestivalHeroImage(festival);
  const hasImage = Boolean(heroImage);
  const description = festival.description ?? "";

  return (
    <Link href={`/festivals/${festival.slug}`} className="group">
      <AppleCard className="h-full">
        {hasImage ? (
          <AppleCardHeader className="aspect-[16/10] border-b apple-border">
            <FallbackImage
              src={heroImage ?? "/hero.svg"}
              alt={festival.title}
              fill
              className="object-cover"
            />
          </AppleCardHeader>
        ) : null}
        <AppleCardBody className="space-y-3">
          <Text variant="muted" size="sm">
            {festivalCityLabel(festival, "Bulgaria")} · {formatFestivalDateLineShort(festival)}
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

