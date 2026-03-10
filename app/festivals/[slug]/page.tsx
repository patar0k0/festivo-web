import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import FestivalDetailClient from "@/components/festival/FestivalDetailClient";
import { getCityFestivals, getFestivalBySlug, getFestivalDetail } from "@/lib/queries";
import { buildFestivalJsonLd, festivalMeta, getBaseUrl } from "@/lib/seo";
import { slugify } from "@/lib/utils";
import "../../landing.css";

export const revalidate = 21600;

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Дата предстои";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

function resolveVenueText(data: { location_name?: string | null; cities?: { name_bg?: string | null } | null; address?: string | null }) {
  return (
    data.location_name?.trim() ||
    data.cities?.name_bg?.trim() ||
    data.address?.trim() ||
    "Локацията ще бъде уточнена"
  );
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);
  if (!festival) return {};

  const meta = festivalMeta(festival);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${getBaseUrl()}/festivals/${slug}`,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getFestivalDetail(slug);

  if (!data) return notFound();

  const jsonLd = buildFestivalJsonLd(data.festival);
  const cityDisplayName = data.festival.cities?.name_bg ?? data.festival.city;
  const cityFilterValue = data.festival.city;
  const citySlug = data.festival.cities?.slug ?? (data.festival.city ? slugify(data.festival.city) : null);
  const dateText = formatDateRange(data.festival.start_date, data.festival.end_date);
  const venueText = resolveVenueText(data.festival);
  const mapQuery =
    data.festival.lat != null && data.festival.lng != null
      ? `${data.festival.lat},${data.festival.lng}`
      : [data.festival.address, cityDisplayName].filter(Boolean).join(", ");
  const mapHref = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;
  const mapEmbedSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : null;
  const calendarMonth = data.festival.start_date ? format(parseISO(data.festival.start_date), "yyyy-MM") : null;

  const relatedResponse = cityFilterValue
    ? await getCityFestivals(
        cityFilterValue,
        { city: [cityFilterValue], free: data.festival.is_free ?? true },
        1,
        6,
      )
    : null;

  const relatedFestivals = (relatedResponse?.data ?? []).filter((item) => item.slug !== data.festival.slug);

  return (
    <div className="landing-bg text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent py-8 md:py-10">
        <Container>
          <FestivalDetailClient
            festival={data.festival}
            media={data.media}
            days={data.days}
            scheduleItems={data.scheduleItems}
            dateText={dateText}
            venueText={venueText}
            mapHref={mapHref}
            mapEmbedSrc={mapEmbedSrc}
            citySlug={citySlug}
            calendarMonth={calendarMonth}
            relatedFestivals={relatedFestivals}
          />
        </Container>
      </Section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  );
}
