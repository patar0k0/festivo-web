import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

type ResolvedCity = {
  id: number;
  name_bg: string;
  slug: string;
};

type AdminContext = NonNullable<Awaited<ReturnType<typeof getAdminContext>>>;

async function findCityById(ctx: AdminContext, cityId: number) {
  const { data, error } = await ctx.supabase.from("cities").select("id,name_bg,slug").eq("id", cityId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ResolvedCity | null;
}

async function runCitySearch(ctx: AdminContext, matcher: "slug" | "nameExact" | "nameFuzzy", q: string) {
  let query = ctx.supabase.from("cities").select("id,name_bg,slug");

  if (matcher === "slug") {
    query = query.eq("slug", q);
  } else if (matcher === "nameExact") {
    query = query.ilike("name_bg", q);
  } else {
    query = query.ilike("name_bg", `%${q}%`);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.[0] ?? null) as ResolvedCity | null;
}

async function findCityByText(ctx: AdminContext, q: string) {
  const bySlug = await runCitySearch(ctx, "slug", q);
  if (bySlug) return bySlug;

  const byName = await runCitySearch(ctx, "nameExact", q);
  if (byName) return byName;

  return runCitySearch(ctx, "nameFuzzy", q);
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const qRaw = searchParams.get("q");
    const q = qRaw?.trim() ?? "";

    if (!q) {
      return NextResponse.json({ error: "Missing q" }, { status: 400 });
    }

    const city = /^\d+$/.test(q) ? await findCityById(ctx, Number(q)) : await findCityByText(ctx, q);

    if (!city) {
      return NextResponse.json({ error: "City not found" }, { status: 404 });
    }

    return NextResponse.json(city);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
