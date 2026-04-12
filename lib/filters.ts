import { endOfMonth, format, parseISO } from "date-fns";
import { festivalDiscoveryCalendarBounds } from "@/lib/home/festivalDiscoveryBounds";
import { type FestivalWhenFilter, Filters } from "@/lib/types";
import { ensureArray } from "@/lib/utils";

function parseWhenParam(raw: string | string[] | undefined): FestivalWhenFilter | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "all" || value === "upcoming" || value === "ongoing" || value === "past") {
    return value;
  }
  return undefined;
}

function parseLegacyDateQueryParam(raw: string | undefined): { from: string; to: string } | null {
  if (!raw?.trim()) {
    return null;
  }
  const value = raw.trim();
  const monthMatch = value.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (month < 1 || month > 12) {
      return null;
    }
    const startDate = parseISO(`${year}-${String(month).padStart(2, "0")}-01`);
    const endDate = endOfMonth(startDate);
    return { from: format(startDate, "yyyy-MM-dd"), to: format(endDate, "yyyy-MM-dd") };
  }

  const dayMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dayMatch) {
    return null;
  }
  const d = parseISO(`${dayMatch[1]}-${dayMatch[2]}-${dayMatch[3]}`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const ymd = format(d, "yyyy-MM-dd");
  return { from: ymd, to: ymd };
}

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const rawWhen = Array.isArray(searchParams.when) ? searchParams.when[0] : searchParams.when;

  let from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  let to = typeof searchParams.to === "string" ? searchParams.to : undefined;

  let when: FestivalWhenFilter | undefined;
  if (rawWhen === "weekend") {
    const { weekendStart, weekendEnd } = festivalDiscoveryCalendarBounds();
    from = weekendStart;
    to = weekendEnd;
    when = undefined;
  } else if (rawWhen === "now") {
    when = "ongoing";
  } else {
    when = parseWhenParam(searchParams.when);
  }

  const legacyDate = typeof searchParams.date === "string" ? searchParams.date : undefined;
  if (!from && !to) {
    const parsed = parseLegacyDateQueryParam(legacyDate);
    if (parsed) {
      from = parsed.from;
      to = parsed.to;
    }
  }

  const city = ensureArray(searchParams.city);
  const catExplicit = ensureArray(searchParams.cat);
  const tag = typeof searchParams.tag === "string" ? searchParams.tag.trim() : undefined;
  const cat = catExplicit?.length ? catExplicit : tag ? [tag] : undefined;

  const freeParam = searchParams.free;
  const free = freeParam === undefined ? undefined : freeParam === "1" || freeParam === "true";

  const qRaw = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const q = qRaw || undefined;

  return {
    city,
    from,
    to,
    cat,
    free,
    sort: (typeof searchParams.sort === "string" ? searchParams.sort : undefined) as Filters["sort"],
    month: typeof searchParams.month === "string" ? searchParams.month : undefined,
    when,
    q,
  };
}

export function withDefaultFilters(filters: Filters): Filters {
  if (filters.free === undefined) {
    return { ...filters, free: true };
  }
  return filters;
}

export function serializeFilters(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.city?.length) params.set("city", filters.city.join(","));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.cat?.length === 1) {
    params.set("tag", filters.cat[0]!);
  } else if (filters.cat && filters.cat.length > 1) {
    params.set("cat", filters.cat.join(","));
  }
  if (filters.free !== undefined) params.set("free", filters.free ? "1" : "0");
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.month) params.set("month", filters.month);
  if (filters.when && filters.when !== "all") params.set("when", filters.when);
  if (filters.q) params.set("q", filters.q);
  const query = params.toString();
  return query ? `?${query}` : "";
}
