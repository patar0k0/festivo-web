import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeSettlementInput, resolveCityReference } from "@/lib/admin/resolveCityReference";
import { festivalPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { canonicalPatchFromUnknown } from "@/lib/festival/validators";


type SaveResponse = {
  ok: true;
  city_created: boolean;
  city: { id: number | null; name_bg: string | null; slug: string | null };
  displayed_city: string | null;
};

type CityRow = {
  id: number;
  slug: string;
  name_bg: string;
};

function parseCityId(value: unknown) {
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
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = canonicalPatchFromUnknown(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const canonical = parsed.data;
    const patch: Record<string, unknown> = {
      ...festivalPatchFromCanonicalPartial(canonical),
      updated_at: new Date().toISOString(),
    };

    if ("is_free" in body && typeof body.is_free === "boolean") {
      patch.is_free = body.is_free;
    }

    if ("is_verified" in body && typeof body.is_verified === "boolean") {
      patch.is_verified = body.is_verified;
    }

    const hasCityInputField = "city_name_display" in canonical;
    const cityInputRaw = typeof canonical.city_name_display === "string" ? canonical.city_name_display : null;
    const hasCityInput = hasCityInputField;
    const hasCityId = "city_id" in body;
    let selectedCity: CityRow | null = null;

    if (hasCityInput) {
      const cityInput = normalizeSettlementInput(cityInputRaw ?? "");

      if (!cityInput) {
        patch.city_id = null;
        patch.city = null;
      } else {
        const resolved = await resolveCityReference(ctx.supabase, cityInput);

        if (resolved) {
          selectedCity = resolved;
          patch.city_id = resolved.id;
          patch.city = resolved.slug;

        } else {
          patch.city_id = null;
          patch.city = cityInput;

        }

        console.info(
          `[festival-save] id=${id} city_input="${cityInputRaw}" resolved_city_id=${resolved?.id ?? "null"} unresolved=${resolved ? "false" : "true"}`
        );
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

    if (!selectedCity && typeof patch.city_id === "number") {
      selectedCity = await findCityById(ctx, patch.city_id);
    }

    const cityDisplay = selectedCity?.name_bg ?? selectedCity?.slug ?? (typeof patch.city === "string" ? patch.city : "");
    const citySlug = selectedCity?.slug ?? (typeof patch.city === "string" ? patch.city : "");
    const cityIdForLog = selectedCity?.id ?? (typeof patch.city_id === "number" ? patch.city_id : null);
    console.info(
      `[admin-festival-edit] festival_id=${id} city_id=${cityIdForLog ?? "null"} city_name_bg="${selectedCity?.name_bg ?? ""}" city_slug="${citySlug}" displayed_city="${cityDisplay}"`
    );

    const { error } = await ctx.supabase.from("festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response: SaveResponse = {
      ok: true,
      city_created: false,
      city: selectedCity
        ? { id: selectedCity.id, name_bg: selectedCity.name_bg, slug: selectedCity.slug }
        : { id: null, name_bg: null, slug: typeof patch.city === "string" ? patch.city : null },
      displayed_city: cityDisplay || null,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  console.info(`[festival-delete] festival_id=${id} start`);

  const { error } = await ctx.supabase.from("festivals").delete().eq("id", id);

  if (error) {
    const reason = error.message.split("\n")[0]?.slice(0, 180) ?? "unknown";
    console.error(`[festival-delete] festival_id=${id} fail reason=${reason}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info(`[festival-delete] festival_id=${id} ok`);
  return NextResponse.json({ ok: true });
}
