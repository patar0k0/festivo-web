import type { Festival, FestivalMediaItem } from "@/lib/types";

export type MobileFestivalListItem = {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  image_url: string | null;
  is_saved: boolean;
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
  organizer: { id: string | null; name: string | null; slug: string | null } | null;
  is_saved: boolean;
};

export function serializeMobileFestivalListItem(festival: Festival, isSaved: boolean): MobileFestivalListItem {
  const imageUrl = festival.hero_image ?? festival.image_url ?? null;
  return {
    id: String(festival.id),
    slug: festival.slug,
    title: festival.title,
    city: festival.city_name_display ?? null,
    start_date: festival.start_date ?? null,
    end_date: festival.end_date ?? null,
    image_url: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
    is_saved: isSaved,
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
): MobileFestivalDetailJson {
  const organizers = festival.organizers?.filter((o) => String(o.id ?? "").trim() && String(o.name ?? "").trim()) ?? [];
  const primary =
    organizers[0] ??
    (festival.organizer?.name
      ? {
          id: festival.organizer.id ?? null,
          name: festival.organizer.name,
          slug: festival.organizer.slug ?? null,
        }
      : null);

  return {
    id: String(festival.id),
    slug: festival.slug,
    title: festival.title,
    description: festival.description ?? null,
    city: festival.city_name_display ?? null,
    dates: {
      start_date: festival.start_date ?? null,
      end_date: festival.end_date ?? null,
      start_time: festival.start_time ?? null,
      end_time: festival.end_time ?? null,
      occurrence_dates: festival.occurrence_dates?.length ? festival.occurrence_dates : null,
    },
    images: buildMobileGalleryImages(festival, media),
    organizer: primary
      ? {
          id: primary.id != null ? String(primary.id) : null,
          name: primary.name ?? null,
          slug: primary.slug ?? null,
        }
      : null,
    is_saved: isSaved,
  };
}
