import { NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { fetchUserSavedFestivalIdSet } from "@/lib/api/mobile/planSaved";
import { serializeMobileFestivalListItem } from "@/lib/api/mobile/festivalSerialization";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivals } from "@/lib/queries";

export const dynamic = "force-dynamic";

function searchParamsToFilterRecord(searchParams: URLSearchParams): Record<string, string | string[] | undefined> {
  const raw: Record<string, string | string[] | undefined> = {};
  const get = (key: string) => {
    const v = searchParams.get(key);
    return v?.trim() ? v.trim() : undefined;
  };
  const when = get("when");
  if (when) raw.when = when;
  const from = get("from");
  if (from) raw.from = from;
  const to = get("to");
  if (to) raw.to = to;
  const date = get("date");
  if (date) raw.date = date;
  const city = get("city");
  if (city) raw.city = city;
  const category = get("category");
  const cat = get("cat");
  if (category) raw.cat = category;
  else if (cat) raw.cat = cat;
  const tag = get("tag");
  if (tag) raw.tag = tag;
  const free = searchParams.get("free");
  if (free !== null && free !== "") raw.free = free;
  const q = get("q");
  if (q) raw.q = q;
  const month = get("month");
  if (month) raw.month = month;
  const sort = get("sort");
  if (sort && sort !== "popular" && sort !== "trending") raw.sort = sort;
  return raw;
}

function parseListingSort(searchParams: URLSearchParams): "default" | "popular" | "trending" {
  const rawSort = searchParams.get("sort");
  const trimmed = rawSort?.trim();
  if (trimmed === "trending") return "trending";
  if (trimmed === "popular") return "popular";
  if (!trimmed) return "trending";
  return "default";
}

function parsePage(searchParams: URLSearchParams): number {
  const raw = searchParams.get("page");
  const n = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return n;
}

function parsePageSize(searchParams: URLSearchParams): number {
  const raw = searchParams.get("limit");
  const n = raw ? Number.parseInt(raw, 10) : 20;
  if (!Number.isFinite(n) || n < 1) {
    return 20;
  }
  return Math.min(50, n);
}

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) {
      return authErr;
    }

    const url = new URL(request.url);
    const filters = parseFilters(searchParamsToFilterRecord(url.searchParams));
    const listingSort = parseListingSort(url.searchParams);
    const page = parsePage(url.searchParams);
    const pageSize = parsePageSize(url.searchParams);

    const result = await getFestivals(filters, page, pageSize, { listingSort });
    const ids = result.data.map((f) => String(f.id));

    let saved = new Set<string>();
    if (auth.user) {
      saved = await fetchUserSavedFestivalIdSet(auth.supabase, auth.user.id, ids);
    }

    const festivals = result.data.map((f) => serializeMobileFestivalListItem(f, saved.has(String(f.id))));

    return NextResponse.json({
      festivals,
      page: result.page,
      page_size: result.pageSize,
      total: result.total,
      total_pages: result.totalPages,
    });
  } catch (e) {
    console.error("[api/mobile/festivals]", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
