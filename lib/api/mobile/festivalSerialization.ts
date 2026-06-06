import type { Festival, FestivalDay, FestivalMediaItem, FestivalScheduleItem } from "@/lib/types";
import { buildMobileFestivalScheduleDto, type MobileFestivalScheduleDto } from "@/lib/api/mobile/mobileScheduleDto";
import { deterministicSettlementJitter, getBulgariaSettlementCentroid } from "@/lib/api/mobile/bulgariaSettlementCentroids";
import { getFestivalHeroImage } from "@/lib/festival/getFestivalHeroImage";
import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";

export type MobileFestivalListItem = {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  /** Normalised city slug (e.g. "sofia", "chupren") — used for city-based filtering on mobile. */
  city_slug?: string | null;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  is_saved: boolean;
  /** WGS84 when present — map markers */
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  is_verified?: boolean | null;
  is_promoted?: boolean | null;
  /** Primary organizer when available — lets mobile route to /organizer/{slug}. */
  organizer?: {
    slug: string | null;
    name: string | null;
  } | null;
};

export type MobileFestivalDetailJson = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  city: string | null;
  dates: {
    start_date: string | null;
    end_date: string | null;
    start_time: string | null;
    end_time: string | null;
    occurrence_dates: string[] | null;
  };
  images: Array<{
    url: string;
    type: string | null;
    caption: string | null;
    sort_order: number | null;
    is_hero: boolean | null;
  }>;
  organizer: {
    id: string | null;
    name: string | null;
    slug: string | null;
    logo_url: string | null;
    verified: boolean | null;
  } | null;
  is_saved: boolean;
  is_liked: boolean;
  likes_count: number;
  category?: string | null;
  tags?: string[] | null;
  is_verified?: boolean | null;
  is_promoted?: boolean | null;
  location?: {
    lat: number | null;
    lng: number | null;
    address: string | null;
    location_name: string | null;
    place_id: string | null;
  } | null;
  /** Canonical program: stable ids, per-day ordering, ISO instants (UTC) from Europe/Sofia wall times. */
  schedule: MobileFestivalScheduleDto;
};

function pickCoord(festival: Festival): { lat: number | null; lng: number | null } {
  const latRaw = festival.lat ?? festival.latitude;
  const lngRaw = festival.lng ?? festival.longitude;
  const lat = typeof latRaw === "number" && Number.isFinite(latRaw) ? latRaw : null;
  const lng = typeof lngRaw === "number" && Number.isFinite(lngRaw) ? lngRaw : null;
  return { lat, lng };
}

/** Listing/map coords: real lat/lng only; otherwise approximate settlement center (+ jitter) from city slug. */
function pickMapListingCoords(festival: Festival): { lat: number | null; lng: number | null } {
  const direct = pickCoord(festival);
  if (direct.lat != null && direct.lng != null) {
    return direct;
  }
  const slug =
    (typeof festival.cities?.slug === "string" && festival.cities.slug.trim()
      ? festival.cities.slug.trim().toLowerCase()
      : null) ??
    (typeof festival.city_slug === "string" && festival.city_slug.trim()
      ? festival.city_slug.trim().toLowerCase()
      : null);
  if (!slug) return { lat: null, lng: null };
  const centroid = getBulgariaSettlementCentroid(slug);
  if (!centroid) return { lat: null, lng: null };
  const j = deterministicSettlementJitter(String(festival.id));
  return { lat: centroid.lat + j.dLat, lng: centroid.lng + j.dLng };
}

function pickPrimaryOrganizerSummary(festival: Festival): { slug: string | null; name: string | null } | null {
  const embed = festival.organizer;
  const embedSlug = typeof embed?.slug === "string" && embed.slug.trim() ? embed.slug.trim() : null;
  const embedName = typeof embed?.name === "string" && embed.name.trim() ? embed.name.trim() : null;
  if (embedSlug || embedName) {
    return { slug: embedSlug, name: embedName };
  }
  const first = festival.organizers?.find((o) => (o?.slug || o?.name)?.toString().trim());
  if (!first) return null;
  const slug = typeof first.slug === "string" && first.slug.trim() ? first.slug.trim() : null;
  const name = typeof first.name === "string" && first.name.trim() ? first.name.trim() : null;
  if (!slug && !name) return null;
  return { slug, name };
}

export function serializeMobileFestivalListItem(festival: Festival, isSaved: boolean): MobileFestivalListItem {
  const imageUrl = getFestivalHeroImage(festival);
  const coords = pickMapListingCoords(festival);
  const cat = typeof festival.category === "string" && festival.category.trim() ? festival.category.trim() : null;
  const promoted = festival.promotion_status === "promoted";
  const citySlug =
    (typeof festival.cities?.slug === "string" && festival.cities.slug.trim()
      ? festival.cities.slug.trim().toLowerCase()
      : null) ??
    (typeof festival.city_slug === "string" && festival.city_slug.trim()
      ? festival.city_slug.trim().toLowerCase()
      : null);
  return {
    id: String(festival.id),
    slug: festival.slug,
    title: festival.title,
    city: getFestivalLocationDisplay(festival).city ?? festival.city_name_display ?? null,
    city_slug: citySlug,
    start_date: festival.start_date ?? null,
    end_date: festival.end_date ?? null,
    image_url: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
    is_saved: isSaved,
    lat: coords.lat,
    lng: coords.lng,
    category: cat,
    is_verified: festival.is_verified ?? null,
    is_promoted: promoted || undefined,
    organizer: pickPrimaryOrganizerSummary(festival) ?? undefined,
  };
}

function buildMobileGalleryImages(festival: Festival, media: FestivalMediaItem[]): MobileFestivalDetailJson["images"] {
  const hero = festival.hero_image ?? festival.image_url;
  const out: MobileFestivalDetailJson["images"] = [];
  const seen = new Set<string>();
  if (typeof hero === "string" && hero.trim()) {
    const u = hero.trim();
    out.push({ url: u, type: "image", caption: null, sort_order: null, is_hero: true });
    seen.add(u);
  }
  for (const m of media) {
    const u = typeof m.url === "string" ? m.url.trim() : "";
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push({
      url: u,
      type: m.type ?? null,
      caption: m.caption ?? null,
      sort_order: typeof m.sort_order === "number" ? m.sort_order : m.sort_order != null ? Number(m.sort_order) : null,
      is_hero: m.is_hero ?? null,
    });
  }
  return out;
}

export function serializeMobileFestivalDetail(
  festival: Festival,
  media: FestivalMediaItem[],
  isSaved: boolean,
  program: {
    days: FestivalDay[];
    scheduleItems: FestivalScheduleItem[];
    isLiked?: boolean;
    likesCount?: number;
  },
): MobileFestivalDetailJson {
  const organizers = festival.organizers?.filter((o) => String(o.id ?? "").trim() && String(o.name ?? "").trim()) ?? [];
  const o0 = organizers[0];
  const fromEmbed = festival.organizer;
  const primary =
    o0 ??
    (fromEmbed?.name
      ? {
          id: fromEmbed.id ?? null,
          name: fromEmbed.name,
          slug: fromEmbed.slug ?? null,
          logo_url: (fromEmbed as { logo_url?: string | null }).logo_url ?? null,
          verified: (fromEmbed as { verified?: boolean | null }).verified ?? null,
        }
      : null);

  const coords = pickCoord(festival);
  const hasCoords = coords.lat != null && coords.lng != null;
  const addr = typeof festival.address === "string" && festival.address.trim() ? festival.address.trim() : null;
  const locName =
    typeof festival.location_name === "string" && festival.location_name.trim() ? festival.location_name.trim() : null;
  const tags =
    Array.isArray(festival.tags) && festival.tags.length
      ? festival.tags.map((t) => String(t).trim()).filter(Boolean)
      : null;

  const organizerOut =
    primary && primary.name
      ? {
          id: primary.id != null ? String(primary.id) : null,
          name: primary.name ?? null,
          slug: primary.slug ?? null,
          logo_url:
            (o0 as { logo_url?: string | null } | undefined)?.logo_url != null
              ? String((o0 as { logo_url?: string | null }).logo_url)
              : (fromEmbed as { logo_url?: string | null } | null)?.logo_url != null
                ? String((fromEmbed as { logo_url?: string | null }).logo_url)
                : null,
          verified:
            typeof (o0 as { verified?: boolean | null } | undefined)?.verified === "boolean"
              ? (o0 as { verified?: boolean | null }).verified!
              : typeof (fromEmbed as { verified?: boolean | null } | null)?.verified === "boolean"
                ? (fromEmbed as { verified?: boolean | null }).verified!
                : null,
        }
      : null;

  return {
    id: String(festival.id),
    slug: festival.slug,
    title: festival.title,
    description: festival.description ?? null,
    city: getFestivalLocationDisplay(festival).city ?? festival.city_name_display ?? null,
    dates: {
      start_date: festival.start_date ?? null,
      end_date: festival.end_date ?? null,
      start_time: festival.start_time ?? null,
      end_time: festival.end_time ?? null,
      occurrence_dates: festival.occurrence_dates?.length ? festival.occurrence_dates : null,
    },
    images: buildMobileGalleryImages(festival, media),
    organizer: organizerOut,
    is_saved: isSaved,
    is_liked: Boolean(program.isLiked),
    likes_count: typeof program.likesCount === "number" && Number.isFinite(program.likesCount)
      ? Math.max(0, Math.floor(program.likesCount))
      : 0,
    category: typeof festival.category === "string" && festival.category.trim() ? festival.category.trim() : null,
    tags: tags?.length ? tags : null,
    is_verified: festival.is_verified ?? null,
    is_promoted: festival.promotion_status === "promoted" || undefined,
    location: hasCoords || addr || locName || festival.place_id
      ? {
          lat: coords.lat,
          lng: coords.lng,
          address: addr,
          location_name: locName,
          place_id: typeof festival.place_id === "string" && festival.place_id.trim() ? festival.place_id.trim() : null,
        }
      : null,
    schedule: buildMobileFestivalScheduleDto(program.days, program.scheduleItems),
  };
}
