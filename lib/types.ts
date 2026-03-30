export type Festival = {
  id: string | number;
  slug: string;
  title: string;
  description?: string | null;
  city_id?: number | null;
  city?: string | null;
  city_name_display?: string | null;
  location_name?: string | null;
  /** Optional venue label when present in API responses / selects. */
  venue_name?: string | null;
  address?: string | null;
  organizer_name?: string | null;
  organizer_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  /** Local wall time from DB (`time`), typically `HH:MM:SS` string from Supabase. */
  start_time?: string | null;
  end_time?: string | null;
  /** Sorted ISO yyyy-MM-dd when the festival runs on separate non-consecutive days; omit for a simple start–end range. */
  occurrence_dates?: string[] | null;
  is_free?: boolean | null;
  category?: string | null;
  hero_image?: string | null;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  ticket_url?: string | null;
  price_range?: string | null;
  website_url?: string | null;
  source_url?: string | null;
  source_type?: string | null;
  tags?: string[] | null;
  status?: string | null;
  promotion_status?: "normal" | "promoted" | null;
  promotion_started_at?: string | null;
  promotion_expires_at?: string | null;
  promotion_rank?: number | null;
  cities?: {
    name_bg?: string | null;
    slug?: string | null;
    is_village?: boolean | null;
  } | null;
  organizer?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    plan?: "free" | "vip" | null;
    plan_started_at?: string | null;
    plan_expires_at?: string | null;
    organizer_rank?: number | null;
  } | null;
  organizers?: Array<{
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    sort_order?: number | null;
  }> | null;
  festival_media?: Array<Partial<FestivalMedia> & { is_primary?: boolean | null }> | null;
};

export type FestivalMedia = {
  id: string | number;
  festival_id: string | number;
  url: string;
  type?: string | null;
  caption?: string | null;
  sort_order?: number | null;
  /** When true and `festivals.hero_image` is empty, may be used as the public hero. */
  is_hero?: boolean | null;
};

export type FestivalDay = {
  id: string | number;
  festival_id: string | number;
  date: string;
  title?: string | null;
};

export type FestivalScheduleItem = {
  id: string | number;
  day_id: string | number;
  start_time?: string | null;
  end_time?: string | null;
  stage?: string | null;
  sort_order?: number | null;
  title: string;
  description?: string | null;
};

export type Filters = {
  city?: string[];
  from?: string;
  to?: string;
  cat?: string[];
  free?: boolean;
  sort?: "soonest" | "curated" | "nearest";
  month?: string;
};

export type PaginatedResult<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};


export type OrganizerProfile = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  email?: string | null;
  phone?: string | null;
  verified?: boolean | null;
  city_id?: number | null;
  cities?: {
    name_bg?: string | null;
    slug?: string | null;
    is_village?: boolean | null;
  } | null;
  city_name_display?: string | null;
  claimed_events_count?: number | null;
  plan?: "free" | "vip" | null;
  plan_started_at?: string | null;
  plan_expires_at?: string | null;
  included_promotions_per_year?: number | null;
  organizer_rank?: number | null;
  created_at?: string | null;
};
