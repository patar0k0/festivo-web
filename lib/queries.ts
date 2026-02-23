import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { supabaseServer } from "@/lib/supabaseServer";
import { Filters, Festival, FestivalDay, FestivalMedia, FestivalScheduleItem, PaginatedResult } from "@/lib/types";
import { withDefaultFilters } from "@/lib/filters";

export const FESTIVAL_SELECT_MIN =
  "id,title,slug,city,region,start_date,end_date,category,image_url,is_free,status,lat,lng,description,ticket_url,price_range";

const FESTIVAL_SELECT_DETAIL =
  "id,title,slug,city,region,address,start_date,end_date,category,image_url,is_free,status,lat,lng,description,ticket_url,price_range,website_url";

function applyFilters<T>(query: T, filters: Filters): T {
  const applied = withDefaultFilters(filters);

  let typedQuery = query as any;
  typedQuery = typedQuery.eq("status", "verified");

  if (applied.free !== undefined) {
    typedQuery = typedQuery.eq("is_free", applied.free);
  }

  if (applied.city?.length) {
    typedQuery = typedQuery.in("city", applied.city);
  }

  if (applied.region?.length) {
    typedQuery = typedQuery.in("region", applied.region);
  }

  if (applied.cat?.length) {
    typedQuery = typedQuery.in("category", applied.cat);
  }

  if (applied.from && applied.to) {
    typedQuery = typedQuery.lte("start_date", applied.to);
    // end_date NULL -> treat as start_date for range checks
    typedQuery = typedQuery.or(
      `end_date.gte.${applied.from},and(end_date.is.null,start_date.gte.${applied.from})`
    );
  } else if (applied.from) {
    // end_date NULL -> treat as start_date for range checks
    typedQuery = typedQuery.or(`start_date.gte.${applied.from},end_date.gte.${applied.from}`);
  } else if (applied.to) {
    typedQuery = typedQuery.lte("start_date", applied.to);
  }

  if (applied.sort === "curated") {
    typedQuery = typedQuery.order("start_date", { ascending: true });
  } else if (applied.sort === "nearest") {
    typedQuery = typedQuery.order("start_date", { ascending: true });
  } else {
    typedQuery = typedQuery.order("start_date", { ascending: true });
  }

  return typedQuery as T;
}

export async function getFestivals(filters: Filters, page = 1, pageSize = 12): Promise<PaginatedResult<Festival>> {
  const supabase = supabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (!supabase) {
    return {
      data: [],
      page,
      pageSize,
      total: 0,
      totalPages: 1,
    };
  }

  let query = supabase.from("festivals").select(FESTIVAL_SELECT_MIN, { count: "exact" });
  query = applyFilters(query, filters);
  const { data, count, error } = await query.range(from, to).returns<Festival[]>();

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  return {
    data: data ?? [],
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getFestivalBySlug(slug: string): Promise<Festival | null> {
  const supabase = supabaseServer();
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase
    .from("festivals")
    .select(FESTIVAL_SELECT_DETAIL)
    .eq("slug", slug)
    .eq("status", "verified")
    .maybeSingle();

  const festival = data as Festival | null;

  if (error || !festival) {
    return null;
  }

  return festival;
}

export async function getFestivalDetail(
  slug: string
): Promise<{
  festival: Festival;
  media: FestivalMedia[];
  days: FestivalDay[];
  scheduleItems: FestivalScheduleItem[];
} | null> {
  const supabase = supabaseServer();
  if (!supabase) return null;
  const festival = await getFestivalBySlug(slug);
  if (!festival) return null;

  const [{ data: media }, { data: days }] = await Promise.all([
    supabase
      .from("festival_media")
      .select("id, festival_id, url, type, caption, sort_order")
      .eq("festival_id", festival.id)
      .order("sort_order", { ascending: true })
      .returns<FestivalMedia[]>(),
    supabase
      .from("festival_days")
      .select("id, festival_id, date, title")
      .eq("festival_id", festival.id)
      .order("date", { ascending: true })
      .returns<FestivalDay[]>(),
  ]);
  const dayIds = (days ?? []).map((day) => day.id);
  const scheduleItems =
    dayIds.length > 0
      ? (
          await supabase
            .from("festival_schedule_items")
            .select("id, day_id, start_time, end_time, stage, title, description, sort_order")
            .in("day_id", dayIds)
            .order("sort_order", { ascending: true })
            .order("start_time", { ascending: true })
            .returns<FestivalScheduleItem[]>()
        ).data
      : [];

  return {
    festival,
    media: media ?? [],
    days: days ?? [],
    scheduleItems: scheduleItems ?? [],
  };
}

export async function getCityFestivals(city: string, filters: Filters, page = 1, pageSize = 10) {
  return getFestivals({ ...filters, city: [city] }, page, pageSize);
}

export async function getCalendarMonth(month: string, filters: Filters) {
  const supabase = supabaseServer();
  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  if (!supabase) {
    return {
      monthStart,
      monthEnd,
      festivals: [],
      days: {},
    };
  }

  let query = supabase.from("festivals").select(FESTIVAL_SELECT_MIN);
  query = applyFilters(query, {
    ...filters,
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  });

  const { data, error } = await query.returns<Festival[]>();

  if (error) {
    throw new Error(error.message);
  }

  const days: Record<string, Festival[]> = {};
  (data ?? []).forEach((festival) => {
    if (!festival.start_date) return;
    const start = parseISO(festival.start_date);
    const end = festival.end_date ? parseISO(festival.end_date) : start;
    let cursor = start;
    while (cursor <= end) {
      const key = format(cursor, "yyyy-MM-dd");
      if (!days[key]) days[key] = [];
      days[key].push(festival);
      cursor = addDays(cursor, 1);
    }
  });

  return {
    monthStart,
    monthEnd,
    festivals: data ?? [],
    days,
  };
}

export async function getCities(): Promise<string[]> {
  const supabase = supabaseServer();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("festivals")
    .select("city")
    .eq("status", "verified")
    .returns<{ city: string | null }[]>();

  if (error) {
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((row) => {
    if (row.city) set.add(row.city);
  });

  return Array.from(set).sort();
}

export async function getFestivalSlugs(): Promise<string[]> {
  const supabase = supabaseServer();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("festivals")
    .select("slug")
    .eq("status", "verified")
    .returns<{ slug: string | null }[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => row.slug).filter((slug): slug is string => Boolean(slug));
}
