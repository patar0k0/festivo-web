import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Filters, Festival, FestivalDay, FestivalMediaItem, FestivalScheduleItem, OrganizerProfile, PaginatedResult } from "@/lib/types";
import { withDefaultFilters } from "@/lib/filters";
import { festivalSettlementSourceText } from "@/lib/settlements/festivalCityText";
import { formatSettlementLocationLines } from "@/lib/settlements/formatLocation";
import { getCityLabel } from "@/lib/settlements/getCityLabel";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";
import { buildFestivalsTagOrFilter } from "@/lib/festivals/buildFestivalsTagOrFilter";
import { festivalDayKeysInMonth, normalizeOccurrenceDatesInput } from "@/lib/festival/occurrenceDates";
import { compareFestivalsForListing, sortFestivalsForListing } from "@/lib/festival/sorting";
import { getFestivalTemporalState } from "@/lib/festival/temporal";
import { parseProgramDraftUnknown, programDraftToDetailSchedule } from "@/lib/festival/programDraft";

export const FESTIVAL_SELECT_MIN =
  "id,title,slug,city_id,start_date,end_date,start_time,end_time,occurrence_dates,category,hero_image,image_url,is_free,status,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,lat,lng,place_id,description,ticket_url,price_range,festival_media(url,type,sort_order,is_hero),cities:cities!left(name_bg,slug,is_village),organizer:organizers!left(id,name,slug,plan,plan_started_at,plan_expires_at,organizer_rank)";

/** Festival rows for `/organizers/[slug]`: nested organizer without plan/rank/promotion-credit fields. */
export const FESTIVAL_SELECT_ORGANIZER_PROFILE =
  "id,title,slug,city_id,start_date,end_date,start_time,end_time,occurrence_dates,category,hero_image,image_url,is_free,status,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,lat,lng,place_id,description,ticket_url,price_range,festival_media(url,type,sort_order,is_hero),cities:cities!left(name_bg,slug,is_village),organizer:organizers!left(id,name,slug)";

/** Public organizer profile fields (no plan, rank, credits, merge state). */
// claimed_events_count: included for future public display, not rendered yet
// No `cities` embed: nested select can fail under anon RLS/embed quirks; city is loaded in a second query.
const PUBLIC_ORGANIZER_SELECT =
  "id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,email,phone,verified,city_id,claimed_events_count";

/** URL segment → DB slug: trim, decode, unify unicode hyphens. */
function normalizeUrlSlugSegment(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    // ignore invalid escape sequences
  }
  return s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-");
}

export function normalizePublicOrganizerSlugParam(raw: string): string {
  return normalizeUrlSlugSegment(raw);
}

/**
 * Public `/festivals/[slug]` (and legacy `/festival/[slug]`) params must be normalized with this before DB lookup
 * so they match stored `festivals.slug` and links built from that column (see `normalizeUrlSlugSegment`).
 */
export function normalizePublicFestivalSlugParam(raw: string): string {
  return normalizeUrlSlugSegment(raw);
}

const FESTIVAL_SELECT_DETAIL =
  "id,title,slug,description,start_date,end_date,start_time,end_time,occurrence_dates,city_id,location_name,address,organizer_id,organizer_name,lat,lng,place_id,hero_image,image_url,video_url,website_url,ticket_url,price_range,is_free,source_url,tags,status,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,program_draft,cities:cities!left(name_bg,slug,is_village),organizer:organizers!left(id,name,slug,plan,plan_started_at,plan_expires_at,organizer_rank),festival_organizers:festival_organizers!left(sort_order,organizers:organizers!left(id,name,slug))";

const NO_MATCH_FESTIVAL_ID = "00000000-0000-0000-0000-000000000001";

/** Reserved filter token when URL city params cannot be mapped to `cities.slug`. */
const IMPOSSIBLE_CITY_SLUG_FILTER = "__festivo_no_city_match__";

async function resolveCityFilterTokensToSlugs(
  supabase: NonNullable<ReturnType<typeof supabaseServer>>,
  tokens: string[],
): Promise<string[] | null> {
  const trimmed = tokens.map((c) => c.trim()).filter(Boolean);
  if (!trimmed.length) return [];
  if (trimmed.every(looksLikeSingleTokenCitySlug)) return trimmed;

  const { data: allCities, error } = await supabase.from("cities").select("slug,name_bg");
  if (error) {
    console.error("[queries] resolveCityFilterTokensToSlugs", error.message);
    return null;
  }

  const byNameBg = new Map<string, string>();
  const bySlug = new Map<string, string>();
  for (const row of allCities ?? []) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    const bg = typeof row.name_bg === "string" ? row.name_bg.trim() : "";
    if (slug) bySlug.set(slug.toLowerCase(), slug);
    if (bg) byNameBg.set(bg.toLowerCase(), slug);
  }

  const out: string[] = [];
  for (const t of trimmed) {
    const tl = t.toLowerCase();
    if (bySlug.has(tl)) {
      out.push(bySlug.get(tl)!);
      continue;
    }
    if (byNameBg.has(tl)) {
      out.push(byNameBg.get(tl)!);
      continue;
    }
    return null;
  }
  return out;
}

async function withCitySlugsResolvedInFilters(
  supabase: NonNullable<ReturnType<typeof supabaseServer>>,
  filters: Filters,
  options?: FilterOptions,
): Promise<Filters> {
  const applied = options?.applyDefaults === false ? filters : withDefaultFilters(filters);
  if (!applied.city?.length) return filters;

  const slugs = await resolveCityFilterTokensToSlugs(supabase, applied.city);
  if (slugs === null) {
    return { ...filters, city: [IMPOSSIBLE_CITY_SLUG_FILTER] };
  }
  return { ...filters, city: slugs };
}

/** Primary single-row reads: log and throw on Supabase error; use `null` only when the row is absent. */
function throwOnSelectError(context: string, error: { message: string } | null | undefined): void {
  if (!error) return;
  console.error(`[queries] ${context}`, error.message);
  throw new Error(`${context}: ${error.message}`);
}

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

function escapePostgrestLikeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, "\\,")
    .replace(/\./g, "\\.");
}

function looksLikeSingleTokenCitySlug(value: string): boolean {
  const s = value.trim();
  if (!s || s.length > 96) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(s);
}

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
    const trimmed = applied.city.map((c) => c.trim()).filter(Boolean);
    typedQuery =
      trimmed.length === 1
        ? typedQuery.eq("cities.slug", trimmed[0]!)
        : typedQuery.in("cities.slug", trimmed);
  }

  if (applied.cat?.length) {
    if (applied.cat.length === 1) {
      typedQuery = typedQuery.or(buildFestivalsTagOrFilter(applied.cat[0]!));
    } else {
      typedQuery = typedQuery.or(applied.cat.map((c) => buildFestivalsTagOrFilter(c)).join(","));
    }
  }

  if (applied.q?.trim()) {
    const textFilter = `%${escapePostgrestLikeValue(applied.q.trim())}%`;
    typedQuery = typedQuery.or(
      `title.ilike.${textFilter},description.ilike.${textFilter},location_name.ilike.${textFilter},organizer_name.ilike.${textFilter}`,
    );
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
  const settlementKind = festival.cities?.is_village;
  const rawLine =
    festivalSettlementSourceText({
      cityRelation: festival.cities ?? null,
      city_name_display: festival.city_name_display,
      city_guess: (festival as Festival & { city_guess?: string | null }).city_guess ?? null,
    }) ?? null;
  const lines = formatSettlementLocationLines(rawLine, settlementKind);
  const city_name_display = lines?.primary ? fixMojibakeBG(lines.primary) : null;

  const occurrenceNorm = normalizeOccurrenceDatesInput((festival as Festival & { occurrence_dates?: unknown }).occurrence_dates);

  return {
    ...festival,
    occurrence_dates: occurrenceNorm,
    title: fixMojibakeBG(festival.title),
    description: festival.description ? fixMojibakeBG(festival.description) : festival.description,
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
  const filtersForQuery = await withCitySlugsResolvedInFilters(supabase, filters, options);
  let query = supabase.from("festivals").select(FESTIVAL_SELECT_MIN);
  query = applyFilters(query, filtersForQuery, options, dateResolution);
  const { data, error } = await query.returns<Festival[]>();

  if (error) {
    throw new Error(error.message);
  }

  const normalized = (data ?? []).map(fixFestivalText);
  const when = filters.when;
  const scoped =
    when && when !== "all" ? normalized.filter((f) => getFestivalTemporalState(f) === when) : normalized;
  const sorted = sortFestivalsForListing(scoped);
  const paginated = sorted.slice(from, to);
  const total = sorted.length;
  return {
    data: paginated,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const FESTIVAL_BY_SLUG_MAX_ATTEMPTS = 2;
const FESTIVAL_BY_SLUG_RETRY_DELAY_MS = 150;

/**
 * One primary row fetch per request: `generateMetadata` and the page both call into this path.
 * React `cache()` dedupes parallel server work so we do not run duplicate slug queries back-to-back.
 */
export const getFestivalBySlug = cache(async function getFestivalBySlug(rawSlug: string): Promise<Festival | null> {
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const supabase = supabaseServer();
  if (!supabase) {
    throw new Error("Festival query failed: Supabase client is not configured");
  }

  let lastMessage = "";
  for (let attempt = 1; attempt <= FESTIVAL_BY_SLUG_MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("festivals")
      .select(FESTIVAL_SELECT_DETAIL)
      .eq("slug", slug)
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .neq("status", "archived")
      .maybeSingle();

    if (!error) {
      const festival = data as Festival | null;
      if (!festival) {
        return null;
      }
      const withOrganizers = await mergeFestivalOrganizersFromJoinTable(supabase, festival);
      return fixFestivalText(withOrganizers);
    }

    lastMessage = error.message;

    if (attempt < FESTIVAL_BY_SLUG_MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, FESTIVAL_BY_SLUG_RETRY_DELAY_MS));
    }
  }

  console.error("[queries] getFestivalBySlug failed after retries", { slug, message: lastMessage });
  throw new Error(`Festival query failed: ${lastMessage}`);
});

export async function getFestivalDetail(
  slug: string
): Promise<{
  festival: Festival;
  media: FestivalMediaItem[];
  days: FestivalDay[];
  scheduleItems: FestivalScheduleItem[];
  usedProgramDraftFallback: boolean;
} | null> {
  const supabase = supabaseServer();
  if (!supabase) {
    throw new Error("Festival query failed: Supabase client is not configured");
  }
  const festival = await getFestivalBySlug(slug);
  if (!festival) return null;

  const [mediaRes, daysRes] = await Promise.all([
    supabase
      .from("festival_media")
      .select("id, festival_id, url, type, caption, sort_order, is_hero")
      .eq("festival_id", festival.id)
      .order("sort_order", { ascending: true })
      .returns<FestivalMediaItem[]>(),
    supabase
      .from("festival_days")
      .select("id, festival_id, date, title")
      .eq("festival_id", festival.id)
      .order("date", { ascending: true })
      .returns<FestivalDay[]>(),
  ]);

  if (mediaRes.error) {
    console.error(`[queries] getFestivalDetail festival_media (${festival.id})`, mediaRes.error);
  }
  if (daysRes.error) {
    console.error(`[queries] getFestivalDetail festival_days (${festival.id})`, daysRes.error);
  }
  const media = mediaRes.error ? [] : (mediaRes.data ?? []);
  const days = daysRes.error ? [] : (daysRes.data ?? []);

  const dayIds = days.map((day) => day.id);
  let scheduleItems: FestivalScheduleItem[] = [];
  if (dayIds.length > 0) {
    const schedRes = await supabase
      .from("festival_schedule_items")
      .select("id, day_id, start_time, end_time, stage, title, description, sort_order")
      .in("day_id", dayIds)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true })
      .returns<FestivalScheduleItem[]>();
    if (schedRes.error) {
      console.error(`[queries] getFestivalDetail festival_schedule_items (${festival.id})`, schedRes.error);
    }
    scheduleItems = schedRes.error ? [] : (schedRes.data ?? []);
  }

  const fixedDays = days.map((day) => ({
    ...day,
    title: day.title ? fixMojibakeBG(day.title) : day.title,
  }));

  const fixedMedia = media.map((item) => ({
    ...item,
    caption: item.caption ? fixMojibakeBG(item.caption) : item.caption,
  }));

  const fixedScheduleItems = (scheduleItems ?? []).map((item) => ({
    ...item,
    title: fixMojibakeBG(item.title),
    stage: item.stage ? fixMojibakeBG(item.stage) : item.stage,
    description: item.description ? fixMojibakeBG(item.description) : item.description,
  }));

  let outDays = fixedDays;
  let outSchedule = fixedScheduleItems;
  let usedProgramDraftFallback = false;
  if (fixedScheduleItems.length === 0 && festival.program_draft != null) {
    const parsed = parseProgramDraftUnknown(festival.program_draft);
    if (parsed.ok) {
      const fromDraft = programDraftToDetailSchedule(parsed.value, festival.id);
      if (fromDraft.scheduleItems.length > 0) {
        outDays = fromDraft.days.map((day) => ({
          ...day,
          title: day.title ? fixMojibakeBG(day.title) : day.title,
        }));
        outSchedule = fromDraft.scheduleItems.map((item) => ({
          ...item,
          title: fixMojibakeBG(item.title),
          stage: item.stage ? fixMojibakeBG(item.stage) : item.stage,
          description: item.description ? fixMojibakeBG(item.description) : item.description,
        }));
        usedProgramDraftFallback = true;
      }
    }
  }

  if (usedProgramDraftFallback) {
    console.warn("[program-fallback]", {
      festivalId: festival.id,
      reason: "no schedule items, using program_draft",
    });
  }

  console.info("[program-load]", {
    schedule_from_rows: fixedScheduleItems.length,
    has_program_draft: festival.program_draft != null,
    used_program_draft_fallback: usedProgramDraftFallback,
  });

  return {
    festival,
    media: fixedMedia,
    days: outDays,
    scheduleItems: outSchedule,
    usedProgramDraftFallback,
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
  const monthFiltersForQuery = await withCitySlugsResolvedInFilters(supabase, monthFilters, options);
  let query = supabase.from("festivals").select(FESTIVAL_SELECT_MIN);
  query = applyFilters(query, monthFiltersForQuery, options, dateResolution);

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
  const links = await getCityLinks();
  return links.map((l) => l.name).sort((a, b) => a.localeCompare(b, "bg"));
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
      name: getCityLabel({ name_bg: fixMojibakeBG(row.name_bg) }),
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

/** Градове с поне един публикуван фестивал; `filterValue` е `cities.slug`. */
export async function getHomeCitySelectOptions(): Promise<
  Array<{ name: string; slug: string | null; filterValue: string }>
> {
  const supabase = supabaseServer();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("festivals")
    .select("cities:cities!inner(slug,name_bg,is_village)")
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .not("city_id", "is", null)
    .returns<Array<{ cities: CityJoinRow | CityJoinRow[] | null }>>();

  if (error || !data?.length) {
    return [];
  }

  const map = new Map<string, { name: string; slug: string | null }>();

  for (const row of data) {
    const joined = normalizeFestivalCityJoin(row.cities);
    const slug = joined?.slug?.trim();
    if (!joined || !slug) continue;

    const name = getCityLabel({
      name_bg: fixMojibakeBG(joined.name_bg ?? slug),
    });
    map.set(slug, { name, slug });
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

/**
 * When an organizer was merged, the source row is `is_active=false` and public lookup by slug fails.
 * Follow `merged_into` (chain-safe) and return the active canonical slug for redirects.
 * Requires service role — anon RLS cannot read inactive organizers.
 */
export async function resolveOrganizerCanonicalSlug(slug: string): Promise<string | null> {
  const admin = supabaseAdmin();
  if (!admin) return null;

  const key = normalizePublicOrganizerSlugParam(slug);

  let start: { slug: string; is_active: boolean | null; merged_into: string | null } | null = null;
  const { data: byEq, error: byEqError } = await admin
    .from("organizers")
    .select("slug,is_active,merged_into")
    .eq("slug", key)
    .maybeSingle();
  throwOnSelectError("resolveOrganizerCanonicalSlug eq slug", byEqError);
  start = byEq;
  if (!start && !/[_%]/.test(key)) {
    const { data: byIlike, error: byIlikeError } = await admin
      .from("organizers")
      .select("slug,is_active,merged_into")
      .ilike("slug", key)
      .limit(2);
    throwOnSelectError("resolveOrganizerCanonicalSlug ilike slug", byIlikeError);
    if (byIlike?.length === 1) start = byIlike[0];
  }

  if (!start) return null;
  if (start.is_active) return start.slug;

  let nextId: string | null = start.merged_into;
  for (let depth = 0; depth < 10 && nextId; depth += 1) {
    const { data: row, error: rowError } = await admin
      .from("organizers")
      .select("slug,is_active,merged_into")
      .eq("id", nextId)
      .maybeSingle();
    throwOnSelectError("resolveOrganizerCanonicalSlug merged_into chain", rowError);
    if (!row) return null;
    if (row.is_active) return row.slug;
    nextId = row.merged_into;
  }
  return null;
}

export async function getOrganizerWithFestivals(
  slug: string,
): Promise<{ organizer: OrganizerProfile; festivals: Festival[] } | null> {
  /** Prefer service role; only open a cookie-bound client when anon fallback is needed. */
  const db = supabaseAdmin() ?? (await createSupabaseServerClient());

  const slugKey = normalizePublicOrganizerSlugParam(slug);

  const baseOrg = () =>
    db.from("organizers").select(PUBLIC_ORGANIZER_SELECT).eq("is_active", true);

  let organizer: OrganizerProfile | null = null;

  const first = await baseOrg().eq("slug", slugKey).maybeSingle<OrganizerProfile>();
  throwOnSelectError("getOrganizerWithFestivals organizer by slug", first.error);
  organizer = first.data;

  if (!organizer && !/[_%]/.test(slugKey)) {
    const second = await baseOrg().ilike("slug", slugKey).limit(2);
    throwOnSelectError("getOrganizerWithFestivals organizer ilike slug", second.error);
    if (second.data?.length === 1) organizer = second.data[0] as OrganizerProfile;
  }

  if (!organizer) {
    return null;
  }

  let cities: OrganizerProfile["cities"] = null;
  if (organizer.city_id != null) {
    const { data: cityRow, error: cityError } = await db
      .from("cities")
      .select("name_bg,slug,is_village")
      .eq("id", organizer.city_id)
      .maybeSingle();
    if (cityError) {
      console.error(`[queries] getOrganizerWithFestivals city (${organizer.city_id})`, cityError);
    } else {
      cities = cityRow ?? null;
    }
  }

  const fixedOrganizer: OrganizerProfile = {
    ...organizer,
    cities,
    name: fixMojibakeBG(organizer.name),
    description: organizer.description ? fixMojibakeBG(organizer.description) : organizer.description,
    city_name_display: (() => {
      const clines = formatSettlementLocationLines(cities?.name_bg ?? null, cities?.is_village);
      return clines?.primary ? fixMojibakeBG(clines.primary) : null;
    })(),
  };

  const { data: links, error: linksError } = await db
    .from("festival_organizers")
    .select("festival_id,sort_order")
    .eq("organizer_id", organizer.id)
    .order("sort_order", { ascending: true })
    .returns<Array<{ festival_id: string; sort_order: number | null }>>();

  if (linksError) {
    console.error(`[queries] getOrganizerWithFestivals festival_organizers (${organizer.id})`, linksError);
  }
  const linkRows = linksError ? [] : (links ?? []);

  const { data: legacyRows, error: legacyError } = await db
    .from("festivals")
    .select("id")
    .eq("organizer_id", organizer.id)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .returns<Array<{ id: string }>>();

  if (legacyError) {
    console.error(`[queries] getOrganizerWithFestivals legacy festivals (${organizer.id})`, legacyError);
  }
  const legacyIdRows = legacyError ? [] : (legacyRows ?? []);

  const m2mIds = linkRows.map((row) => row.festival_id).filter(Boolean);
  const legacyIds = legacyIdRows.map((row) => row.id).filter(Boolean);
  const festivalIds = Array.from(new Set([...m2mIds, ...legacyIds]));

  if (!festivalIds.length) {
    return {
      organizer: fixedOrganizer,
      festivals: [],
    };
  }

  const { data: festivals, error: festivalsError } = await db
    .from("festivals")
    .select(FESTIVAL_SELECT_ORGANIZER_PROFILE)
    .in("id", festivalIds)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .returns<Festival[]>();

  if (festivalsError) {
    console.error(`[queries] getOrganizerWithFestivals festivals by id (${organizer.id})`, festivalsError);
  }
  const festivalRows = festivalsError ? [] : (festivals ?? []);

  const sortOrderByFestivalId = new Map(
    linkRows.map((row) => [row.festival_id, row.sort_order ?? 9999]),
  );

  return {
    organizer: fixedOrganizer,
    festivals: (() => {
      const rawFestivals = festivalRows;
      const fixed = rawFestivals.map(fixFestivalText);
      return fixed.sort((a, b) => {
        const pastA = getFestivalTemporalState(a) === "past" ? 1 : 0;
        const pastB = getFestivalTemporalState(b) === "past" ? 1 : 0;
        if (pastA !== pastB) return pastA - pastB;
        const bySort =
          (sortOrderByFestivalId.get(String(a.id)) ?? 9999) - (sortOrderByFestivalId.get(String(b.id)) ?? 9999);
        if (bySort !== 0) return bySort;
        return compareFestivalsForListing(a, b);
      });
    })(),
  };
}
