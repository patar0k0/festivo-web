import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import FestivalDetailClient from "@/components/festival/FestivalDetailClient";
import TrackFestivalView from "@/components/festival/TrackFestivalView";
import { getAdminSession } from "@/lib/admin/isAdmin";
import { getFestivalViewCounts, type FestivalViewCounts } from "@/lib/analytics/festivalViewCounts";
import { fetchAccommodationOffersForFestival } from "@/lib/accommodation/fetchAccommodationOffers";
import { canPreviewNonPublicFestival, isFestivalPublicDetailCatalogVisible } from "@/lib/festival/detailPreviewAccess";
import {
  getCityFestivals,
  getFestivalBySlug,
  getFestivalDetail,
  normalizePublicFestivalSlugParam,
} from "@/lib/queries";
import { buildFestivalJsonLd, festivalMeta, getBaseUrl } from "@/lib/seo";
import { debugLog } from "@/lib/utils/debugLog";
import { pub } from "@/lib/public-ui/styles";
import { countBookingOutboundClicksLast30Days } from "@/lib/outbound/bookingIntent";
import { sortFestivalsForListing } from "@/lib/festival/sorting";
import { buildGoogleMapsEmbedSrc, buildGoogleMapsUrl } from "@/lib/location/buildGoogleMapsUrl";

/** Match `/organizers/[slug]`: avoid caching a stale `notFound()` / partial payload across soft navigation and ISR. */
export const dynamic = "force-dynamic";

const SAFE_PUBLIC_FESTIVAL_METADATA = {
  title: "Festivo",
  description: "Открий фестивали в България",
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const festival = await getFestivalBySlug(slug);
  if (!festival) {
    return { ...SAFE_PUBLIC_FESTIVAL_METADATA };
  }

  const catalogVisible = isFestivalPublicDetailCatalogVisible(festival);
  if (!catalogVisible) {
    const canPreview = await canPreviewNonPublicFestival(festival);
    if (!canPreview) {
      return { ...SAFE_PUBLIC_FESTIVAL_METADATA };
    }
  }

  const meta = festivalMeta(festival);
  const canonical = `${getBaseUrl()}/festivals/${slug}`;
  const isPreviewMetadata = !catalogVisible;
  const pageTitle = isPreviewMetadata ? `[Преглед] ${festival.title}` : meta.title;
  const ogImages =
    meta.shareImageUrl != null ? [{ url: meta.shareImageUrl, alt: festival.title }] : undefined;
  const previewSafeDescription = "Този фестивал все още не е публичен.";

  if (isPreviewMetadata) {
    return {
      title: pageTitle,
      description: previewSafeDescription,
      alternates: {
        canonical: undefined,
      },
      openGraph: {
        title: pageTitle,
        description: previewSafeDescription,
      },
      twitter: {
        card: "summary",
        title: pageTitle,
        description: previewSafeDescription,
      },
      robots: {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      },
    };
  }

  return {
    title: pageTitle,
    ...(meta.description ? { description: meta.description } : {}),
    alternates: {
      canonical,
    },
    openGraph: {
      title: pageTitle,
      ...(meta.description ? { description: meta.description } : {}),
      url: canonical,
      siteName: "Festivo",
      locale: "bg_BG",
      type: "website",
      ...(ogImages ? { images: ogImages } : {}),
    },
    twitter: {
      card: ogImages ? "summary_large_image" : "summary",
      title: pageTitle,
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

  /** Missing row only — fetch failures throw and are handled by `app/festivals/error.tsx`. */
  if (!data) return notFound();

  if (!isFestivalPublicDetailCatalogVisible(data.festival)) {
    const canPreview = await canPreviewNonPublicFestival(data.festival);
    if (!canPreview) {
      debugLog("error", "RLS blocked access", { slug });
      return notFound();
    }
  }

  const showPendingApprovalBadge = !isFestivalPublicDetailCatalogVisible(data.festival);

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
  const mapHref = buildGoogleMapsUrl({
    placeId: data.festival.place_id,
    latitude: mapLat ?? undefined,
    longitude: mapLng ?? undefined,
  });
  const mapEmbedRaw = buildGoogleMapsEmbedSrc({
    lat: mapLat ?? undefined,
    lng: mapLng ?? undefined,
  });
  const mapEmbedSrc = mapEmbedRaw || null;
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

  // For admin viewers, fetch raw festival_view counts so the badge can render.
  // Bot / admin / 24h-dedup filtering already happened at insert time.
  let adminViewCounts: FestivalViewCounts | null = null;
  if (adminSession?.isAdmin) {
    adminViewCounts = await getFestivalViewCounts(String(data.festival.id));
  }

  const relatedFestivals = sortFestivalsForListing(
    (relatedResponse?.data ?? []).filter((item) => item.slug !== data.festival.slug),
  );

  const adminEditHref = adminSession?.isAdmin ? `/admin/festivals/${String(data.festival.id)}` : null;
  const showTravelPopularLabel = bookingClicks30d >= 2;

  return (
    <div className={pub.page}>
      <TrackFestivalView
        festivalId={String(data.festival.id)}
        slug={data.festival.slug ?? null}
      />
      <Section className={pub.section}>
        <Container>
          <FestivalDetailClient
            festival={data.festival}
            adminViewCounts={adminViewCounts}
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
            showPendingApprovalBadge={showPendingApprovalBadge}
          />
        </Container>
      </Section>

      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
    </div>
  );
}
