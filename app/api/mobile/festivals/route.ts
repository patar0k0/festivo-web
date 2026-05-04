import { NextResponse } from "next/server";
import { parseFilters } from "@/lib/filters";
import { fetchUserSavedFestivalIdSet } from "@/lib/api/mobile/planSaved";
import { serializeMobileFestivalListItem } from "@/lib/api/mobile/festivalSerialization";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { getFestivals } from "@/lib/queries";

export const dynamic = "force-dynamic";

function parseListFilters(searchParams: URLSearchParams) {
  const raw: Record<string, string | string[] | undefined> = {};
  const city = searchParams.get("city");
  if (city?.trim()) {
    raw.city = city.trim();
  }
  const category = searchParams.get("category");
  if (category?.trim()) {
    raw.cat = category.trim();
  }
  return parseFilters(raw);
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
    const filters = parseListFilters(url.searchParams);
    const page = parsePage(url.searchParams);
    const pageSize = parsePageSize(url.searchParams);

    const result = await getFestivals(filters, page, pageSize);
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
