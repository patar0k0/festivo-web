import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Filters, Festival, FestivalDay, FestivalMedia, FestivalScheduleItem, OrganizerProfile, PaginatedResult } from "@/lib/types";
import { withDefaultFilters } from "@/lib/filters";
import { formatSettlementDisplayName } from "@/lib/settlements/formatDisplayName";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { festivalDayKeysInMonth, normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { sortFestivalsForListing } from "@/lib/festival/sorting";

export const FESTIVAL_SELECT_MIN =
  "id,title,slug,city_id,city,start_date,end_date,start_time,end_time,occurrence_dates,category,hero_image,image_url,is_free,status,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,lat,lng,description,ticket_url,price_range,festival_media(url,type,sort_order,is_hero),cities:cities!left(name_bg,slug,is_village),organizer:organizers!left(id,name,slug,plan,plan_started_at,plan_expires_at,organizer_rank)";

const FESTIVAL_SELECT_DETAIL =
  "id,title,slug,description,start_date,end_date,start_time,end_time,occurrence_dates,city_id,city,location_name,address,organizer_id,organizer_name,lat,lng,hero_image,image_url,website_url,ticket_url,price_range,is_free,source_url,tags,status,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,cities:cities!left(name_bg,slug,is_village),organizer:organizers!left(id,name,slug,plan,plan_started_at,plan_expires_at,organizer_rank),festival_organizers:festival_organizers!left(sort_order,organizers:organizers!left(id,name,slug))";

const NO_MATCH_FESTIVAL_ID = "00000000-0000-0000-0000-000000000001";


type FestivalOrganizerLinkRow = {
  sort_order?: number | null;
  organizers?: { id?: string | null; name?: string | null; slug?: string | null } | null;
  /** PostgREST често връща ед. число за FK към organizers */
  organizer?: { id?: string | null; name?: string | null; slug?: string | null } | null;
};

function nestedOrganizerFromLink(link: FestivalOrganizerLinkRow): { id?: string | null; name?: string | null; slug?: string | null } | null {
  const raw = link.organizers ?? link.organizer;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const first = raw[0];
    return first && typeof first === "object" ? first : null;
  }
  return raw;
}

function getFestivalOrganizers(festival: Festival): Array<{ id?: string | null; name?: string | null; slug?: string | null; sort_order?: number | null }> {
  const links = (festival as Festival & { festival_organizers?: FestivalOrganizerLinkRow[] | null }).festival_organizers;

  return (links ?? [])
    .map((link) => {
      const org = nestedOrganizerFromLink(link);
      return {
        id: org?.id ?? null,
        name: org?.name ?? null,
        slug: org?.slug ?? null,
        sort_order: typeof link.sort_order === "number" ? link.sort_order : null,
      };
    })
    .filter((row) => Boolean(String(row.id ?? "").trim() && String(row.name ?? "").trim()))
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
}

/**
 * Явно зареждане на M2M връзки — вграденият select към festivals често връща грешен/непълен масив при >1 организатор.
 * Използва service role клиент, когато е наличен: при anon ключа RLS често позволява `festival_organizers`, но не и `organizers`,
 * и вторият SELECT връща 0 реда → празна секция „Информация“.
 */
async function mergeFestivalOrganizersFromJoinTable(
  supabase: NonNullable<ReturnType<typeof supabaseServer>>,
  festival: Festival
): Promise<Festival> {
  const db = supabaseAdmin() ?? supabase;
  const festivalId = String(festival.id);
  const { data: links, error: linksError } = await db
    .from("festival_organizers")
    .select("organizer_id,sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: true })
    .returns<Array<{ organizer_id: string; sort_order: number | null }>>();

  if (linksError) {
    console.error("[queries] festival_organizers lookup failed", { festivalId, message: linksError.message });
    return festival;
  }

  const orderedLinks = links ?? [];
  const ids = [...new Set(orderedLinks.map((l) => l.organizer_id).filter(Boolean))];
  if (ids.length === 0) {
    return festival;
  }

  const { data: orgRows, error: orgError } = await db.from("organizers").select("id,name,slug").in("id", ids);

  if (orgError) {
    console.error("[queries] organizers by id lookup failed", { festivalId, message: orgError.message });
    return festival;
  }

  const orgById = new Map((orgRows ?? []).map((o) => [String(o.id), o]));

  const syntheticLinks = orderedLinks
    .map((link): FestivalOrganizerLinkRow | null => {
      const org = orgById.get(String(link.organizer_id));
      const name = org?.name?.trim() ?? "";
      if (!org || !name) return null;
      return {
        sort_order: link.sort_order,
        organizers: { id: org.id, name: org.name, slug: org.slug },
      };
    })
    .filter((row): row is FestivalOrganizerLinkRow => row !== null);

  if (syntheticLinks.length === 0) {
    return festival;
  }

  return {
    ...festival,
    festival_organizers: syntheticLinks,
  } as Festival;
}

function applyPublicScope<T>(query: T): T {
  type QueryWithOrAndNeq<Q> = Q & {
    or: (filters: string) => Q;
    neq: (column: string, value: unknown) => Q;
  };

  const scopedQuery = query as QueryWithOrAndNeq<T>;
  const withOr = scopedQuery.or("status.eq.published,status.eq.verified,is_verified.eq.true") as QueryWithOrAndNeq<T>;
  return withOr.neq("status", "archived") as T;
}

type FilterQuery<T> = {
  eq: (column: string, value: unknown) => T;
  in: (column: string, values: readonly string[]) => T;
  lte: (column: string, value: string) => T;
  or: (filters: string) => T;
  order: (column: string, options?: { ascending: boolean }) => T;
};

type FilterOptions = {
  applyDefaults?: boolean;
};

type DateFilterResolution = { kind: "rpc"; ids: string[] } | { kind: "legacy" };

async function resolveFestivalDateFilterIds(
  supabase: NonNullable<ReturnType<typeof supabaseServer>>,
  filters: Filters,
  options?: FilterOptions,
): Promise<DateFilterResolution> {
  const applied = options?.applyDefaults === false ? filters : withDefaultFilters(filters);
  if (!applied.from && !applied.to) {
    return { kind: "legacy" };
  }
  const from = applied.from ?? "1970-01-01";
  const to = applied.to ?? "2099-12-31";
  const { data, error } = await supabase.rpc("festivals_intersecting_range", { p_from: from, p_to: to });
  if (error) {
    console.warn("[queries] festivals_intersecting_range RPC failed, using legacy date filter", error.message);
    return { kind: "legacy" };
  }
  const ids = (data ?? [])
    .map((row: { festival_id?: string }) => (typeof row?.festival_id === "string" ? row.festival_id : ""))
    .filter(Boolean);
  return { kind: "rpc", ids };
}

function applyFilters<T extends FilterQuery<T>>(
  query: T,
  filters: Filters,
  options?: FilterOptions,
  dateResolution: DateFilterResolution = { kind: "legacy" },
): T {
  const applied = options?.applyDefaults === false ? filters : withDefaultFilters(filters);

  let typedQuery = query;
  typedQuery = applyPublicScope(typedQuery);

  if (applied.free !== undefined) {
    if (applied.free) {
      typedQuery = typedQuery.or("is_free.eq.true,is_free.is.null");
    } else {
      typedQuery = typedQuery.eq("is_free", false);
    }
  }

  if (applied.city?.length) {
    typedQuery = typedQuery.in("city", applied.city);
  }

  if (applied.cat?.length) {
    typedQuery = typedQuery.in("category", applied.cat);
  }

  if (dateResolution.kind === "rpc") {
    if (dateResolution.ids.length === 0) {
      typedQuery = typedQuery.eq("id", NO_MATCH_FESTIVAL_ID);
    } else {
      typedQuery = typedQuery.in("id", dateResolution.ids);
    }
  } else if (applied.from && applied.to) {
    typedQuery = typedQuery.lte("start_date", applied.to);
    typedQuery = typedQuery.or(
      `end_date.gte.${applied.from},and(end_date.is.null,start_date.gte.${applied.from})`,
    );
  } else if (applied.from) {
    typedQuery = typedQuery.or(`start_date.gte.${applied.from},end_date.gte.${applied.from}`);
  } else if (applied.to) {
    typedQuery = typedQuery.lte("start_date", applied.to);
  }

  typedQuery = typedQuery.order("start_date", { ascending: true });

  return typedQuery;
}

export function fixFestivalText(festival: Festival): Festival {
  const rawDisplayName = festival.cities?.name_bg ?? festival.city;
  const settlementKind = festival.cities?.is_village;
  const city_name_display = formatSettlementDisplayName(rawDisplayName, settlementKind);

  const occurrenceNorm = normalizeOccurrenceDatesInput((festival as Festival & { occurrence_dates?: unknown }).occurrence_dates);

  return {
    ...festival,
    occurrence_dates: occurrenceNorm,
    title: fixMojibakeBG(festival.title),
    description: festival.description ? fixMojibakeBG(festival.description) : festival.description,
    city: festival.city ? fixMojibakeBG(festival.city) : festival.city,
    address: festival.address ? fixMojibakeBG(festival.address) : festival.address,
    location_name: festival.location_name ? fixMojibakeBG(festival.location_name) : festival.location_name,
    venue_name: festival.location_name ? fixMojibakeBG(festival.location_name) : festival.location_name,
    city_name_display,
    latitude: festival.lat ?? null,
    longitude: festival.lng ?? null,
    hero_image: festival.hero_image ?? festival.image_url ?? null,
    organizer_name: (() => {
      if (festival.organizer_name) return fixMojibakeBG(festival.organizer_name);
      const organizers = getFestivalOrganizers(festival);
      const firstOrganizerName = organizers[0]?.name;
      if (firstOrganizerName) return fixMojibakeBG(firstOrganizerName);
      if (festival.organizer?.name) return fixMojibakeBG(festival.organizer.name);
      return festival.organizer_name;
    })(),
    organizers: getFestivalOrganizers(festival),
  };
}

export async function getFestivals(
  filters: Filters,
  page = 1,
  pageSize = 12,
  options?: FilterOptions
): Promise<PaginatedResult<Festival>> {
  const supabase = supabaseServer();
  const from = (page - 1) * pageSize;
  const to = from + pageSize;

  if (!supabase) {
    return {
      data: [],
      page,
      pageSize,
      total: 0,
      totalPages: 1,
    };
  }

  const dateResolution = await resolveFestivalDateFilterIds(supabase, filters, options);
  let query = supabase.from("festivals").select(FESTIVAL_SELECT_MIN, { count: "exact" });
  query = applyFilters(query, filters, options, dateResolution);
  const { data, count, error } = await query.returns<Festival[]>();

  if (error) {
    throw new Error(error.message);
  }

  const normalized = (data ?? []).map(fixFestivalText);
  const sorted = sortFestivalsForListing(normalized);
  const paginated = sorted.slice(from, to);
  const total = count ?? sorted.length;
  return {
    data: paginated,
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
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .maybeSingle();

  const festival = data as Festival | null;

  if (error || !festival) {
    return null;
  }

  const withOrganizers = await mergeFestivalOrganizersFromJoinTable(supabase, festival);
  return fixFestivalText(withOrganizers);
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
      .select("id, festival_id, url, type, caption, sort_order, is_hero")
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

  const fixedDays = (days ?? []).map((day) => ({
    ...day,
    title: day.title ? fixMojibakeBG(day.title) : day.title,
  }));

  const fixedMedia = (media ?? []).map((item) => ({
    ...item,
    caption: item.caption ? fixMojibakeBG(item.caption) : item.caption,
  }));

  const fixedScheduleItems = (scheduleItems ?? []).map((item) => ({
    ...item,
    title: fixMojibakeBG(item.title),
    stage: item.stage ? fixMojibakeBG(item.stage) : item.stage,
    description: item.description ? fixMojibakeBG(item.description) : item.description,
  }));

  return {
    festival,
    media: fixedMedia,
    days: fixedDays,
    scheduleItems: fixedScheduleItems,
  };
}

export async function getCityFestivals(city: string, filters: Filters, page = 1, pageSize = 10) {
  return getFestivals({ ...filters, city: [city] }, page, pageSize);
}

export async function getCalendarMonth(month: string, filters: Filters, options?: FilterOptions) {
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

  const monthFilters = {
    ...filters,
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  };
  const dateResolution = await resolveFestivalDateFilterIds(supabase, monthFilters, options);
  let query = supabase.from("festivals").select(FESTIVAL_SELECT_MIN);
  query = applyFilters(query, monthFilters, options, dateResolution);

  const { data, error } = await query.returns<Festival[]>();

  if (error) {
    throw new Error(error.message);
  }

  const days: Record<string, Festival[]> = {};
  const sortedData = sortFestivalsForListing((data ?? []).map(fixFestivalText));
  sortedData.forEach((festival) => {
    const keys = festivalDayKeysInMonth(festival, monthStart, monthEnd);
    if (!keys.length) return;
    for (const key of keys) {
      if (!days[key]) days[key] = [];
      days[key].push(festival);
    }
  });

  return {
    monthStart,
    monthEnd,
    festivals: sortedData,
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
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .returns<{ city: string | null }[]>();

  if (error) {
    return [];
  }

  const set = new Set<string>();
  (data ?? []).forEach((row) => {
    if (row.city) set.add(fixMojibakeBG(row.city));
  });

  return Array.from(set).sort();
}

export async function getCityLinks(): Promise<Array<{ name: string; slug: string }>> {
  const supabase = supabaseServer();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("cities")
    .select("name_bg,slug,is_village")
    .order("name_bg", { ascending: true })
    .returns<Array<{ name_bg: string | null; slug: string | null; is_village: boolean | null }>>();

  if (error) {
    return [];
  }

  return (data ?? [])
    .filter((row): row is { name_bg: string; slug: string; is_village: boolean | null } =>
      Boolean(row.name_bg && row.slug),
    )
    .map((row) => ({
      name: formatSettlementDisplayName(row.name_bg, row.is_village) ?? fixMojibakeBG(row.name_bg),
      slug: row.slug,
    }));
}

type CityJoinRow = { slug: string | null; name_bg: string | null; is_village: boolean | null };

function normalizeFestivalCityJoin(
  raw: CityJoinRow | CityJoinRow[] | null | undefined,
): CityJoinRow | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Градове, които реално се срещат в публикувани фестивали (полето `city` е стойността за филтъра). */
export async function getHomeCitySelectOptions(): Promise<
  Array<{ name: string; slug: string | null; filterValue: string }>
> {
  const supabase = supabaseServer();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("festivals")
    .select("city, cities:cities!left(slug,name_bg,is_village)")
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .not("city", "is", null)
    .returns<
      Array<{
        city: string | null;
        cities: CityJoinRow | CityJoinRow[] | null;
      }>
    >();

  if (error || !data?.length) {
    return [];
  }

  const map = new Map<string, { name: string; slug: string | null }>();

  for (const row of data) {
    const key = row.city?.trim();
    if (!key) continue;

    const prev = map.get(key) ?? {
      name: fixMojibakeBG(key),
      slug: null as string | null,
    };
    const joined = normalizeFestivalCityJoin(row.cities);
    const slug = joined?.slug ?? prev.slug;
    const name = joined?.name_bg
      ? formatSettlementDisplayName(joined.name_bg, joined.is_village) ?? fixMojibakeBG(joined.name_bg)
      : prev.name;
    map.set(key, { name, slug });
  }

  return Array.from(map.entries())
    .map(([filterValue, { name, slug }]) => ({ filterValue, name, slug }))
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));
}

export async function getFestivalSlugs(): Promise<string[]> {
  const supabase = supabaseServer();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from("festivals")
    .select("slug")
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .returns<{ slug: string | null }[]>();

  if (error) {
    return [];
  }

  return (data ?? []).map((row) => row.slug).filter((slug): slug is string => Boolean(slug));
}

export async function getOrganizerWithFestivals(
  slug: string,
): Promise<{ organizer: OrganizerProfile; festivals: Festival[] } | null> {
  const supabase = await createSupabaseServerClient();

  console.info("[organizer-public] lookup start", { slug });

  const { data: organizer, error: organizerError } = await supabase
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,email,phone,verified,city_id,cities:cities!left(name_bg,slug,is_village)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<OrganizerProfile>();

  if (organizerError) {
    console.error("[organizer-public] organizer lookup error", {
      slug,
      error: organizerError.message,
    });
  }

  console.info("[organizer-public] organizer lookup result", {
    slug,
    found: Boolean(organizer),
    organizerId: organizer?.id ?? null,
    organizerName: organizer?.name ?? null,
  });

  if (!organizer) {
    return null;
  }

  const fixedOrganizer: OrganizerProfile = {
    ...organizer,
    name: fixMojibakeBG(organizer.name),
    description: organizer.description ? fixMojibakeBG(organizer.description) : organizer.description,
    city_name_display: formatSettlementDisplayName(
      organizer.cities?.name_bg ?? null,
      organizer.cities?.is_village,
    ),
  };

  const { data: links, error: linksError } = await supabase
    .from("festival_organizers")
    .select("festival_id,sort_order")
    .eq("organizer_id", organizer.id)
    .order("sort_order", { ascending: true })
    .returns<Array<{ festival_id: string; sort_order: number | null }>>();

  if (linksError) {
    throw new Error(linksError.message);
  }

  const festivalIds = Array.from(new Set((links ?? []).map((row) => row.festival_id).filter(Boolean)));

  if (!festivalIds.length) {
    return {
      organizer: fixedOrganizer,
      festivals: [],
    };
  }

  const { data: festivals, error: festivalsError } = await supabase
    .from("festivals")
    .select(FESTIVAL_SELECT_MIN)
    .in("id", festivalIds)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .returns<Festival[]>();

  if (festivalsError) {
    throw new Error(festivalsError.message);
  }

  const sortOrderByFestivalId = new Map((links ?? []).map((row) => [row.festival_id, row.sort_order ?? 9999]));

  return {
    organizer: fixedOrganizer,
    festivals: (() => {
      const listingSorted = sortFestivalsForListing((festivals ?? []).map(fixFestivalText));
      return listingSorted.sort((a, b) => {
        const bySort = (sortOrderByFestivalId.get(String(a.id)) ?? 9999) - (sortOrderByFestivalId.get(String(b.id)) ?? 9999);
        if (bySort !== 0) return bySort;
        return 0;
      });
    })(),
  };
}
