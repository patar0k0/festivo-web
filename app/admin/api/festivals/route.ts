import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;

function asString(value: string | null) {
  return typeof value === "string" ? value : "";
}

async function resolveCityId(city: string, supabase: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>["supabase"]) {
  const trimmed = city.trim();
  if (!trimmed) return null;

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

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const status = asString(url.searchParams.get("status"));
    const city = asString(url.searchParams.get("city"));
    const category = asString(url.searchParams.get("category"));
    const free = asString(url.searchParams.get("free"));
    const q = asString(url.searchParams.get("q"));

    let query = ctx.supabase
      .from("festivals")
      .select("id,title,city,city_id,start_date,end_date,category,is_free,status,updated_at,source_type,cities:cities!left(id,name_bg,slug)")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
      query = query.eq("status", status);
    }

    if (city) {
      const cityId = await resolveCityId(city, ctx.supabase);
      if (cityId != null) {
        query = query.eq("city_id", cityId);
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
