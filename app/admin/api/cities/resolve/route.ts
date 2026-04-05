import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { slugify } from "@/lib/utils";

type ResolvedCity = {
  id: number;
  name_bg: string;
  slug: string;
  is_village: boolean | null;
};

type AdminContext = NonNullable<Awaited<ReturnType<typeof getAdminContext>>>;

type CityResolveQueryFn = {
  findBySlugExact: (slug: string) => Promise<ResolvedCity | null>;
  findByNameCaseInsensitive: (name: string) => Promise<ResolvedCity | null>;
  findSuggestions: (name: string, slug: string, limit: number) => Promise<ResolvedCity[]>;
};

type CityResolveResult = {
  city: ResolvedCity | null;
  normalizedInput: string;
  suggestions: ResolvedCity[];
};

function uniqueCities(cities: ResolvedCity[]) {
  const seen = new Set<number>();
  const unique: ResolvedCity[] = [];

  for (const city of cities) {
    if (!seen.has(city.id)) {
      seen.add(city.id);
      unique.push(city);
    }
  }

  return unique;
}

function hasCyrillic(value: string) {
  return /[\u0400-\u04FF]/.test(value);
}

async function resolveCity(input: string, queryFn: CityResolveQueryFn): Promise<CityResolveResult> {
  const normalizedInput = input.trim().toLocaleLowerCase("bg-BG");
  const slugCandidate = slugify(input.trim()).toLowerCase();

  if (!normalizedInput) {
    return { city: null, normalizedInput, suggestions: [] };
  }

  if (slugCandidate) {
    const bySlug = await queryFn.findBySlugExact(slugCandidate);
    if (bySlug) {
      return { city: bySlug, normalizedInput, suggestions: [] };
    }
  }

  const byName = await queryFn.findByNameCaseInsensitive(normalizedInput);
  if (byName) {
    return { city: byName, normalizedInput, suggestions: [] };
  }

  if (hasCyrillic(normalizedInput)) {
    const cyrillicFallbackSlug = slugify(normalizedInput).toLowerCase();
    if (cyrillicFallbackSlug && cyrillicFallbackSlug !== slugCandidate) {
      const byCyrillicFallbackSlug = await queryFn.findBySlugExact(cyrillicFallbackSlug);
      if (byCyrillicFallbackSlug) {
        return { city: byCyrillicFallbackSlug, normalizedInput, suggestions: [] };
      }
    }
  }

  const suggestions = await queryFn.findSuggestions(normalizedInput, slugCandidate || normalizedInput, 5);
  return { city: null, normalizedInput, suggestions };
}

async function findCityById(ctx: AdminContext, cityId: number) {
  const { data, error } = await ctx.supabase.from("cities").select("id,name_bg,slug,is_village").eq("id", cityId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ResolvedCity | null;
}

function buildCityResolveQuery(ctx: AdminContext): CityResolveQueryFn {
  return {
    async findBySlugExact(slug) {
      const { data, error } = await ctx.supabase.from("cities").select("id,name_bg,slug,is_village").eq("slug", slug).limit(1);
      if (error) throw new Error(error.message);
      return (data?.[0] ?? null) as ResolvedCity | null;
    },
    async findByNameCaseInsensitive(name) {
      const { data, error } = await ctx.supabase.from("cities").select("id,name_bg,slug,is_village").ilike("name_bg", name).limit(5);
      if (error) throw new Error(error.message);

      const exact = (data ?? []).find((city) => city.name_bg.toLocaleLowerCase("bg-BG") === name);
      return (exact ?? data?.[0] ?? null) as ResolvedCity | null;
    },
    async findSuggestions(name, slug, limit) {
      const [nameResult, slugResult] = await Promise.all([
        ctx.supabase.from("cities").select("id,name_bg,slug,is_village").ilike("name_bg", `%${name}%`).limit(limit),
        ctx.supabase.from("cities").select("id,name_bg,slug,is_village").ilike("slug", `%${slug}%`).limit(limit),
      ]);

      if (nameResult.error) throw new Error(nameResult.error.message);
      if (slugResult.error) throw new Error(slugResult.error.message);

      return uniqueCities([...(nameResult.data ?? []), ...(slugResult.data ?? [])]).slice(0, limit) as ResolvedCity[];
    },
  };
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

    if (/^\d+$/.test(q)) {
      const cityById = await findCityById(ctx, Number(q));
      if (!cityById) {
        return NextResponse.json({ error: "City not found", normalized_input: q.trim().toLocaleLowerCase("bg-BG") }, { status: 404 });
      }

      return NextResponse.json(cityById);
    }

    const resolved = await resolveCity(q, buildCityResolveQuery(ctx));

    if (!resolved.city) {
      return NextResponse.json(
        {
          error: "City not found",
          normalized_input: resolved.normalizedInput,
          suggestions: resolved.suggestions,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(resolved.city);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
