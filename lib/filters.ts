import { Filters } from "@/lib/types";
import { ensureArray } from "@/lib/utils";

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): Filters {
  const city = ensureArray(searchParams.city);
  const region = ensureArray(searchParams.region);
  const cat = ensureArray(searchParams.cat);
  const freeParam = searchParams.free;
  const free = freeParam === undefined ? undefined : freeParam === "1" || freeParam === "true";

  return {
    city,
    region,
    from: typeof searchParams.from === "string" ? searchParams.from : undefined,
    to: typeof searchParams.to === "string" ? searchParams.to : undefined,
    cat,
    free,
    sort: (typeof searchParams.sort === "string" ? searchParams.sort : undefined) as Filters["sort"],
    month: typeof searchParams.month === "string" ? searchParams.month : undefined,
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
  if (filters.region?.length) params.set("region", filters.region.join(","));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.cat?.length) params.set("cat", filters.cat.join(","));
  if (filters.free !== undefined) params.set("free", filters.free ? "1" : "0");
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.month) params.set("month", filters.month);
  const query = params.toString();
  return query ? `?${query}` : "";
}
