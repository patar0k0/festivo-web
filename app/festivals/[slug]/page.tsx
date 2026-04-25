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
import { pub } from "@/lib/public-ui/styles";
import { countBookingOutboundClicksLast30Days } from "@/lib/outbound/bookingIntent";
import { sortFestivalsForListing } from "@/lib/festival/sorting";
import { buildGoogleMapsEmbedSrc, buildGoogleMapsUrl } from "@/lib/location/buildGoogleMapsUrl";

/** Match `/organizers/[slug]`: avoid caching a stale `notFound()` / partial payload across soft navigation and ISR. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const festival = await getFestivalBySlug(slug);
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
  const citySlug = data.festival.cities?.slug?.trim() || null;
  const cityFilterValue = citySlug;
  const mapLat = data.festival.latitude ?? data.festival.lat;
  const mapLng = data.festival.longitude ?? data.festival.lng;
  const mapQuery =
    mapLat != null && mapLng != null && Number.isFinite(Number(mapLat)) && Number.isFinite(Number(mapLng))
      ? `${mapLat},${mapLng}`
      : null;
  const mapHref = buildGoogleMapsUrl({
    placeId: data.festival.place_id,
    lat: mapLat ?? undefined,
    lng: mapLng ?? undefined,
  });
  // #region agent log
  {
    const city = data.festival.cities?.name_bg ?? data.festival.city_name_display ?? null;
    const locationName = data.festival.venue_name ?? data.festival.location_name ?? null;
    void fetch("http://127.0.0.1:7623/ingest/bc8b4488-04a6-48d3-8da7-51e0d37fa3c8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a187c0" },
      body: JSON.stringify({
        sessionId: "a187c0",
        location: "app/festivals/[slug]/page.tsx:mapHref",
        message: "[maps-debug] server + [maps-debug-url]",
        data: {
          hypothesisId: "H1",
          placeId: (data.festival.place_id ?? "").toString().slice(0, 64),
          lat: mapLat,
          lng: mapLng,
          locationName,
          city,
          mapHref,
        },
        timestamp: Date.now(),
        runId: "post-fix",
      }),
    }).catch(() => {});
  }
  // #endregion
  const mapEmbedRaw = buildGoogleMapsEmbedSrc({
    lat: mapLat ?? undefined,
    lng: mapLng ?? undefined,
  });
  const mapEmbedSrc =
    mapEmbedRaw || (mapQuery ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed` : null);
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

  const relatedFestivals = sortFestivalsForListing(
    (relatedResponse?.data ?? []).filter((item) => item.slug !== data.festival.slug),
  );

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
            programItemPlanActions={!data.usedProgramDraftFallback}
          />
        </Container>
      </Section>

      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
    </div>
  );
}
