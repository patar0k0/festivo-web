export const CANONICAL_FESTIVAL_FIELDS = [
  "title",
  "slug",
  "description",
  "category",
  "tags",
  "city_id",
  "city_name_display",
  "region",
  "venue_name",
  "address",
  "latitude",
  "longitude",
  "start_date",
  "end_date",
  "organizer_name",
  "hero_image",
  "website_url",
  "ticket_url",
  "price_range",
  "source_url",
  "source_type",
  "status",
] as const;

export type CanonicalFestivalField = (typeof CANONICAL_FESTIVAL_FIELDS)[number];

export type CanonicalFestivalPayload = {
  title: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  city_id: number | null;
  city_name_display: string | null;
  region: string | null;
  venue_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  organizer_name: string | null;
  hero_image: string | null;
  website_url: string | null;
  ticket_url: string | null;
  price_range: string | null;
  source_url: string | null;
  source_type: string | null;
  status: string | null;
};

export type CanonicalFestivalPatchPayload = {
  title?: string;
  slug?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string[] | null;
  city_id?: number | null;
  city_name_display?: string | null;
  region?: string | null;
  venue_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  organizer_name?: string | null;
  hero_image?: string | null;
  website_url?: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  status?: string | null;
};
