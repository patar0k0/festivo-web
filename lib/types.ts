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
  tags?: string[] | null;
  hero_image?: string | null;
  cover_image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
};

export type FestivalMedia = {
  id: string | number;
  festival_id: string | number;
  url: string;
  type?: string | null;
};

export type FestivalDay = {
  id: string | number;
  festival_id: string | number;
  date: string;
  label?: string | null;
};

export type FestivalScheduleItem = {
  id: string | number;
  festival_id: string | number;
  festival_day_id?: string | number | null;
  time?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
};

export type Filters = {
  city?: string[];
  region?: string[];
  from?: string;
  to?: string;
  cat?: string[];
  free?: boolean;
  tags?: string[];
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
