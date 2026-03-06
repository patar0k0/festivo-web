import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { resolveOrCreateCity } from "@/lib/admin/resolveOrCreateCity";

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

async function findCityById(ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>, cityId: number) {
  const { data, error } = await ctx.supabase.from("cities").select("id,slug,name_bg").eq("id", cityId).maybeSingle();

  if (error) {
    throw new Error(`City lookup failed: ${error.message}`);
  }

  return (data ?? null) as CityRow | null;
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
    let selectedCity: CityRow | null = null;

    if (hasCityInput) {
      try {
        const resolved = await resolveOrCreateCity(cityInputRaw);

        if (resolved.city) {
          selectedCity = resolved.city;
          patch.city_id = resolved.city.id;
          patch.city = resolved.city.slug;
        } else {
          patch.city_id = null;
          patch.city = null;
        }

        console.info(
          `[festival-save] id=${id} city_input="${cityInputRaw}" display_name="${resolved.displayName}" slug="${resolved.slug}" resolved_city_id=${resolved.city?.id ?? "null"} created=${resolved.created}`
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

        selectedCity = city;
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

    if (!selectedCity && typeof patch.city_id === "number") {
      selectedCity = await findCityById(ctx, patch.city_id);
    }

    const cityDisplay = selectedCity?.name_bg ?? (typeof patch.city === "string" ? patch.city : "");
    const citySlug = selectedCity?.slug ?? (typeof patch.city === "string" ? patch.city : "");
    const cityIdForLog = selectedCity?.id ?? (typeof patch.city_id === "number" ? patch.city_id : null);
    console.info(`[festival-save] city_display="${cityDisplay}" city_slug="${citySlug}" city_id=${cityIdForLog ?? "null"}`);

    const { error } = await ctx.supabase.from("festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      city_created: resolvedCityCreated,
      city: selectedCity
        ? { id: selectedCity.id, name_bg: selectedCity.name_bg, slug: selectedCity.slug }
        : { id: null, name_bg: null, slug: typeof patch.city === "string" ? patch.city : null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
