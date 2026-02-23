export type Festival = {
  id: string | number;
  slug: string;
  title: string;
  description?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_free?: boolean | null;
  category?: string | null;
  image_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  ticket_url?: string | null;
  price_range?: string | null;
  website_url?: string | null;
  status?: string | null;
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
