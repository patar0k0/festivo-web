import { addDays, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { supabaseServer } from "@/lib/supabaseServer";
import { Filters, Festival, FestivalDay, FestivalMedia, FestivalScheduleItem, PaginatedResult } from "@/lib/types";
import { withDefaultFilters } from "@/lib/filters";

const FESTIVAL_FIELDS = [
  "id",
  "slug",
  "title",
  "description",
  "city",
  "region",
  "address",
  "start_date",
  "end_date",
  "is_free",
  "category",
  "tags",
  "hero_image",
  "cover_image",
  "latitude",
  "longitude",
  "status",
].join(",");

function applyFilters(query: any, filters: Filters) {
  const applied = withDefaultFilters(filters);

  query = query.eq("status", "verified");

  if (applied.free !== undefined) {
    query = query.eq("is_free", applied.free);
  }

  if (applied.city?.length) {
    query = query.in("city", applied.city);
  }

  if (applied.region?.length) {
    query = query.in("region", applied.region);
  }

  if (applied.cat?.length) {
    query = query.in("category", applied.cat);
  }

  if (applied.tags?.length) {
    query = query.contains("tags", applied.tags);
  }

  if (applied.from) {
    query = query.gte("end_date", applied.from);
  }

  if (applied.to) {
    query = query.lte("start_date", applied.to);
  }

  if (applied.sort === "curated") {
    query = query.order("start_date", { ascending: true });
  } else if (applied.sort === "nearest") {
    query = query.order("start_date", { ascending: true });
  } else {
    query = query.order("start_date", { ascending: true });
  }

  return query;
}

export async function getFestivals(filters: Filters, page = 1, pageSize = 12): Promise<PaginatedResult<Festival>> {
  const supabase = supabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from<Festival>("festivals").select(FESTIVAL_FIELDS, { count: "exact" });
  query = applyFilters(query, filters);
  const { data, count, error } = await query.range(from, to);

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
  const { data, error } = await supabase
    .from("festivals")
    .select("*")
    .eq("slug", slug)
    .eq("status", "verified")
    .single()
    .returns<Festival>();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getFestivalDetail(slug: string) {
  const supabase = supabaseServer();
  const festival = await getFestivalBySlug(slug);
  if (!festival) return null;

  const [{ data: media }, { data: days }, { data: scheduleItems }] = await Promise.all([
    supabase
      .from<FestivalMedia>("festival_media")
      .select("id, festival_id, url, type")
      .eq("festival_id", festival.id),
    supabase
      .from<FestivalDay>("festival_days")
      .select("id, festival_id, date, label")
      .eq("festival_id", festival.id)
      .order("date", { ascending: true }),
    supabase
      .from<FestivalScheduleItem>("festival_schedule_items")
      .select("id, festival_id, festival_day_id, time, title, description, location")
      .eq("festival_id", festival.id)
      .order("time", { ascending: true }),
  ]);

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

  let query = supabase.from<Festival>("festivals").select(FESTIVAL_FIELDS);
  query = applyFilters(query, {
    ...filters,
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  });

  const { data, error } = await query;

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

export async function getCities() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from<{ city: string | null }>("festivals")
    .select("city")
    .eq("status", "verified");

  if (error) {
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((row) => {
    if (row.city) set.add(row.city);
  });

  return Array.from(set).sort();
}

export async function getFestivalSlugs() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from<{ slug: string | null }>("festivals")
    .select("slug")
    .eq("status", "verified");

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => row.slug).filter((slug): slug is string => Boolean(slug));
}
