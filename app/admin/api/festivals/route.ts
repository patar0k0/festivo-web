import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;
const TIME_OPTIONS = ["upcoming", "past", "all"] as const;
type TimeOption = (typeof TIME_OPTIONS)[number];

function asTime(value: string | null): TimeOption {
  if (value && (TIME_OPTIONS as readonly string[]).includes(value)) {
    return value as TimeOption;
  }
  return "upcoming";
}

/** YYYY-MM-DD in UTC for use with DATE columns (no TZ ambiguity for whole-day comparisons). */
function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const SORT_OPTIONS = [
  "start_date_asc",
  "start_date_desc",
  "updated_desc",
  "created_desc",
] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const DEFAULT_SORT: SortOption = "start_date_asc";

function asSort(value: string | null): SortOption {
  if (value && (SORT_OPTIONS as readonly string[]).includes(value)) {
    return value as SortOption;
  }
  return DEFAULT_SORT;
}

function asString(value: string | null) {
  return typeof value === "string" ? value : "";
}

async function resolveCityId(city: string, supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"]) {
  const trimmed = city.trim();
  if (!trimmed) return null;

  /** Matches admin city filter dropdown (`city_id` as string). */
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  const { data } = await supabase
    .from("cities")
    .select("id")
    .or(`slug.eq.${trimmed},name_bg.ilike.${trimmed}`)
    .limit(1)
    .maybeSingle<{ id: number }>();

  return data?.id ?? null;
}

/** Prefer explicit `city_id` when present so filters stay aligned with canonical cities. */
function parseCityIdParam(raw: string | null): number | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const status = asString(url.searchParams.get("status"));
    const cityIdParam = parseCityIdParam(url.searchParams.get("city_id"));
    const city = asString(url.searchParams.get("city"));
    const category = asString(url.searchParams.get("category"));
    const free = asString(url.searchParams.get("free"));
    const q = asString(url.searchParams.get("q"));

    const sort = asSort(url.searchParams.get("sort"));
    const time = asTime(url.searchParams.get("time"));

    let query = ctx.supabase
      .from("festivals")
      .select(
        "id,title,description,city,city_id,start_date,end_date,start_time,end_time,occurrence_dates,category,is_free,status,updated_at,created_at,source_type,location_name,organizer_name,hero_image,tags,cities:cities!festivals_city_id_fkey(id,name_bg,slug)",
      )
      .limit(200);

    // Default: chronological — what's coming next, freshest within each day.
    // `nullsFirst: false` so festivals without start_date (rare) don't crowd the top.
    switch (sort) {
      case "start_date_desc":
        query = query
          .order("start_date", { ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false });
        break;
      case "updated_desc":
        query = query.order("updated_at", { ascending: false });
        break;
      case "created_desc":
        query = query.order("created_at", { ascending: false, nullsFirst: false });
        break;
      case "start_date_asc":
      default:
        query = query
          .order("start_date", { ascending: true, nullsFirst: false })
          .order("updated_at", { ascending: false });
        break;
    }

    if (STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
      query = query.eq("status", status);
    }

    if (cityIdParam != null) {
      query = query.eq("city_id", cityIdParam);
    } else if (city) {
      const resolved = await resolveCityId(city, ctx.supabase);
      if (resolved != null) {
        query = query.eq("city_id", resolved);
      } else {
        query = query.ilike("city", `%${city}%`);
      }
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (free === "1") {
      query = query.eq("is_free", true);
    }

    if (free === "0") {
      query = query.eq("is_free", false);
    }

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }

    // Time filter — by default admin only sees upcoming + ongoing festivals so
    // past events don't crowd the list (Bulgaria has ~hundreds of festivals
    // per year; past dataset grows unboundedly). Switch to "past" or "all"
    // explicitly when needed for moderation/audit.
    //
    // Logic: a festival is "upcoming/ongoing" iff COALESCE(end_date, start_date)
    // is today or later. PostgREST doesn't support COALESCE in filters, so we
    // express it as: (end_date >= today) OR (end_date IS NULL AND start_date >= today).
    if (time !== "all") {
      const today = todayIsoDate();
      if (time === "upcoming") {
        query = query.or(
          `end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`,
        );
      } else {
        // past
        query = query.or(
          `end_date.lt.${today},and(end_date.is.null,start_date.lt.${today})`,
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      rows: (data ?? []).map((row) => {
        const cityRow = Array.isArray(row.cities) ? row.cities[0] : row.cities;

        return {
          ...row,
          id: String(row.id),
          city: cityRow?.name_bg ?? cityRow?.slug ?? row.city ?? null,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
