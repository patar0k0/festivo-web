export type Festival = {
  id: string | number;
  slug: string;
  title: string;
  description?: string | null;
  city_id?: number | null;
  city?: string | null;
  city_name_display?: string | null;
  region?: string | null;
  location_name?: string | null;
  venue_name?: string | null;
  address?: string | null;
  organizer_name?: string | null;
  organizer_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
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
  cities?: {
    name_bg?: string | null;
    slug?: string | null;
  } | null;
  organizer?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
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
  region?: string[];
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
  claimed_events_count?: number | null;
  created_at?: string | null;
};
