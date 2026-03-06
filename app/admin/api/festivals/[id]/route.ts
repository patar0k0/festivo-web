import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { slugify } from "@/lib/utils";

type Payload = {
  title?: string;
  category?: string | null;
  city?: string | null;
  city_id?: number | string | null;
  region?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  image_url?: string | null;
  website_url?: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_free?: boolean;
  is_verified?: boolean;
  status?: "draft" | "verified" | "rejected" | "archived";
  tags?: string[];
  description?: string | null;
};

type CityRow = {
  id: number;
  slug: string;
  name_bg: string;
};

function parseCityId(value: Payload["city_id"]) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function normalizeCityInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toDisplayCityName(value: string) {
  const lowered = value.toLocaleLowerCase("bg-BG");
  const [first = "", ...rest] = lowered;
  return `${first.toLocaleUpperCase("bg-BG")}${rest.join("")}`;
}

async function findCityById(ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>, cityId: number) {
  const { data, error } = await ctx.supabase.from("cities").select("id,slug,name_bg").eq("id", cityId).maybeSingle();

  if (error) {
    throw new Error(`City lookup failed: ${error.message}`);
  }

  return (data ?? null) as CityRow | null;
}

async function findCityBySlug(ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>, slug: string) {
  const { data, error } = await ctx.supabase.from("cities").select("id,slug,name_bg").eq("slug", slug).maybeSingle();

  if (error) {
    throw new Error(`City slug lookup failed: ${error.message}`);
  }

  return (data ?? null) as CityRow | null;
}

async function findCityByName(ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>, name: string) {
  const { data, error } = await ctx.supabase.from("cities").select("id,slug,name_bg").ilike("name_bg", name).limit(5);

  if (error) {
    throw new Error(`City name lookup failed: ${error.message}`);
  }

  const exact = (data ?? []).find((city) => city.name_bg.toLocaleLowerCase("bg-BG") === name.toLocaleLowerCase("bg-BG"));
  return ((exact ?? data?.[0]) ?? null) as CityRow | null;
}

async function resolveOrCreateCity(ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>, inputRaw: string) {
  const normalizedInput = normalizeCityInput(inputRaw);

  if (!normalizedInput) {
    return { city: null, created: false, normalizedInput };
  }

  if (/^\d+$/.test(normalizedInput)) {
    const cityById = await findCityById(ctx, Number(normalizedInput));
    if (!cityById) {
      throw new Error("City not found by id");
    }

    return { city: cityById, created: false, normalizedInput };
  }

  const slug = slugify(normalizedInput).toLowerCase();
  if (!slug) {
    throw new Error("City slug is empty");
  }

  const cityBySlug = await findCityBySlug(ctx, slug);
  if (cityBySlug) {
    return { city: cityBySlug, created: false, normalizedInput };
  }

  const cityByName = await findCityByName(ctx, normalizedInput);
  if (cityByName) {
    return { city: cityByName, created: false, normalizedInput };
  }

  const displayName = toDisplayCityName(normalizedInput);

  const { data: inserted, error: insertError } = await ctx.supabase
    .from("cities")
    .insert({
      name_bg: displayName,
      slug,
    })
    .select("id,slug,name_bg")
    .maybeSingle();

  if (!insertError && inserted) {
    return { city: inserted as CityRow, created: true, normalizedInput };
  }

  if (insertError?.code === "23505") {
    const cityAfterConflict = await findCityBySlug(ctx, slug);
    if (cityAfterConflict) {
      return { city: cityAfterConflict, created: false, normalizedInput };
    }
  }

  throw new Error(`City insert failed: ${insertError?.message ?? "unknown error"}`);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as Payload;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedKeys: Array<keyof Payload> = [
      "title",
      "category",
      "city",
      "region",
      "address",
      "start_date",
      "end_date",
      "image_url",
      "website_url",
      "ticket_url",
      "price_range",
      "lat",
      "lng",
      "is_free",
      "is_verified",
      "status",
      "tags",
      "description",
    ];

    allowedKeys.forEach((key) => {
      if (key in body) {
        patch[key] = body[key];
      }
    });

    const cityInputRaw = typeof body.city === "string" ? body.city : null;
    const hasCityInput = cityInputRaw !== null;
    const hasCityId = "city_id" in body;

    if (hasCityInput) {
      try {
        const resolved = await resolveOrCreateCity(ctx, cityInputRaw);

        if (resolved.city) {
          patch.city_id = resolved.city.id;
          patch.city = resolved.city.slug;
        } else {
          patch.city_id = null;
          patch.city = null;
        }

        console.info(
          `[festival-save] id=${id} city_input="${cityInputRaw}" resolved_city_id=${resolved.city?.id ?? "null"} resolved_slug="${resolved.city?.slug ?? ""}" created=${resolved.created}`
        );

        patch._resolved_city_created = resolved.created;
      } catch (cityError) {
        const message = cityError instanceof Error ? cityError.message : "City resolve failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } else if (hasCityId) {
      const cityId = parseCityId(body.city_id);
      if (Number.isNaN(cityId)) {
        return NextResponse.json({ error: "Invalid city_id" }, { status: 400 });
      }

      if (cityId === null) {
        patch.city_id = null;
        patch.city = null;
      } else {
        const city = await findCityById(ctx, cityId);

        if (!city?.slug) {
          return NextResponse.json({ error: "City not found" }, { status: 404 });
        }

        patch.city_id = cityId;
        patch.city = city.slug;
      }
    }

    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
    }

    if (typeof patch.lat === "number" && (patch.lat < -90 || patch.lat > 90)) {
      return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
    }

    if (typeof patch.lng === "number" && (patch.lng < -180 || patch.lng > 180)) {
      return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
    }

    const resolvedCityCreated = Boolean(patch._resolved_city_created);
    delete patch._resolved_city_created;

    const { error } = await ctx.supabase.from("festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, city_created: resolvedCityCreated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
