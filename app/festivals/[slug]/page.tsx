import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import FestivalDetailClient from "@/components/festival/FestivalDetailClient";
import { getAdminSession } from "@/lib/admin/isAdmin";
import { fetchAccommodationOffersForFestival } from "@/lib/accommodation/fetchAccommodationOffers";
import {
  getCityFestivals,
  getFestivalBySlug,
  getFestivalDetail,
  normalizePublicFestivalSlugParam,
} from "@/lib/queries";
import { buildFestivalJsonLd, festivalMeta, getBaseUrl } from "@/lib/seo";
import { slugify } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
import { countBookingOutboundClicksLast30Days } from "@/lib/outbound/bookingIntent";

/** Match `/organizers/[slug]`: avoid caching a stale `notFound()` / partial payload across soft navigation and ISR. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  let festival: Awaited<ReturnType<typeof getFestivalBySlug>> = null;
  try {
    festival = await getFestivalBySlug(slug);
  } catch {
    return {};
  }
  if (!festival) return {};

  const meta = festivalMeta(festival);
  const canonical = `${getBaseUrl()}/festivals/${slug}`;
  const ogImages =
    meta.shareImageUrl != null ? [{ url: meta.shareImageUrl, alt: festival.title }] : undefined;

  return {
    title: meta.title,
    ...(meta.description ? { description: meta.description } : {}),
    alternates: {
      canonical,
    },
    openGraph: {
      title: meta.title,
      ...(meta.description ? { description: meta.description } : {}),
      url: canonical,
      siteName: "Festivo",
      locale: "bg_BG",
      type: "website",
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title: meta.title,
      ...(meta.description ? { description: meta.description } : {}),
      ...(ogImages ? { images: [ogImages[0].url] } : {}),
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const data = await getFestivalDetail(slug);

  /** Missing published row only — fetch failures throw and are handled by `app/festivals/error.tsx`. */
  if (!data) return notFound();

  const galleryImageUrls = data.media
    .filter((m) => {
      const t = (m.type ?? "").toLowerCase();
      return t !== "video" && !t.includes("video");
    })
    .map((m) => m.url)
    .filter(Boolean) as string[];
  const jsonLd = buildFestivalJsonLd(data.festival, {
    mediaUrls: galleryImageUrls,
  });
  const cityFilterValue = data.festival.city;
  const citySlug = data.festival.cities?.slug ?? (data.festival.city ? slugify(data.festival.city) : null);
  const mapQuery =
    data.festival.latitude != null && data.festival.longitude != null
      ? `${data.festival.latitude},${data.festival.longitude}`
      : null;
  const mapHref = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;
  const mapEmbedSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`
    : null;
  const calendarMonth = data.festival.start_date ? format(parseISO(data.festival.start_date), "yyyy-MM") : null;

  const [relatedResponse, adminSession, accommodationOffers, bookingClicks30d] = await Promise.all([
    cityFilterValue
      ? getCityFestivals(
          cityFilterValue,
          { city: [cityFilterValue], free: data.festival.is_free ?? true },
          1,
          6,
        )
      : Promise.resolve(null),
    getAdminSession(),
    fetchAccommodationOffersForFestival(data.festival),
    countBookingOutboundClicksLast30Days(String(data.festival.id)),
  ]);

  const relatedFestivals = (relatedResponse?.data ?? []).filter((item) => item.slug !== data.festival.slug);

  const adminEditHref = adminSession?.isAdmin ? `/admin/festivals/${String(data.festival.id)}` : null;
  const showTravelPopularLabel = bookingClicks30d >= 2;

  return (
    <div className={pub.page}>
      <Section className={pub.section}>
        <Container>
          <FestivalDetailClient
            festival={data.festival}
            media={data.media}
            days={data.days}
            scheduleItems={data.scheduleItems}
            mapHref={mapHref}
            mapEmbedSrc={mapEmbedSrc}
            citySlug={citySlug}
            calendarMonth={calendarMonth}
            relatedFestivals={relatedFestivals}
            accommodationOffers={accommodationOffers}
            adminEditHref={adminEditHref}
            showTravelPopularLabel={showTravelPopularLabel}
          />
        </Container>
      </Section>

      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
    </div>
  );
}
