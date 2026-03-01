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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);
  if (!festival) return {};

  const meta = festivalMeta(festival);
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: `${getBaseUrl()}/festival/${slug}`,
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
  const citySlug = data.festival.city ? slugify(data.festival.city) : null;
  const dateText = formatDateRange(data.festival.start_date, data.festival.end_date);
  const venueText = [data.festival.city, data.festival.address].filter(Boolean).join(", ") || "Локация предстои";
  const mapQuery = data.festival.lat && data.festival.lng
    ? `${data.festival.lat},${data.festival.lng}`
    : [data.festival.address, data.festival.city].filter(Boolean).join(", ");
  const mapHref = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;
  const calendarMonth = data.festival.start_date ? format(parseISO(data.festival.start_date), "yyyy-MM") : null;

  const relatedResponse = data.festival.city
    ? await getCityFestivals(
        data.festival.city,
        { city: [data.festival.city], free: data.festival.is_free ?? true },
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
