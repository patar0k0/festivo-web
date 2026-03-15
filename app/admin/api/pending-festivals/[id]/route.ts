import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeSettlementInput, resolveCityReference } from "@/lib/admin/resolveCityReference";
import { pendingPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { canonicalPatchFromUnknown } from "@/lib/festival/validators";

const EXTRA_EDITABLE_FIELDS = [
  "description_clean",
  "description_short",
  "category_guess",
  "tags_guess",
  "city_guess",
  "city_name_display",
  "location_guess",
  "address_guess",
  "latitude_guess",
  "longitude_guess",
  "lat_guess",
  "lng_guess",
  "date_guess",
  "source_primary_url",
  "source_count",
  "discovered_via",
  "hero_image_source",
  "hero_image_original_url",
  "hero_image_score",
  "title_clean",
  "title_guess",
  "normalization_version",
  "verification_status",
  "verification_score",
  "extraction_version",
  "duplicate_of",
] as const;

function isAllowedExtraValue(value: unknown) {
  if (value === null) return true;
  if (typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return true;
  if (typeof value === "object") return true;
  return false;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    console.info(`[pending-save] pending_id=${id} start`);
    const body = (await request.json()) as Record<string, unknown>;
    console.info(`[pending-save] pending_id=${id} payload keys=${Object.keys(body).join(",")}`);
    const cityForInput = typeof body.city_name_display === "string" ? body.city_name_display : typeof body.city === "string" ? body.city : "";
    const cityInputForLog = cityForInput ? normalizeSettlementInput(cityForInput) : "";
    const tagsCountForLog = Array.isArray(body.tags) ? body.tags.length : body.tags === null ? 0 : 0;
    console.info(`[pending-save] pending_id=${id} city input="${cityInputForLog}"`);
    console.info(`[pending-save] pending_id=${id} tags_count=${tagsCountForLog}`);

    const parsed = canonicalPatchFromUnknown(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const canonical = parsed.data;
    const patch: Record<string, unknown> = pendingPatchFromCanonicalPartial(canonical);

    if ("is_free" in body && typeof body.is_free === "boolean") {
      patch.is_free = body.is_free;
    }

    if ("city_name_display" in canonical) {
      const cityInputRaw = typeof canonical.city_name_display === "string" ? canonical.city_name_display : "";
      const cityInput = normalizeSettlementInput(cityInputRaw);

      if (!cityInput) {
        patch.city_id = null;
      } else {
        const resolvedCity = await resolveCityReference(ctx.supabase, cityInput);
        console.info(`[pending-save] pending_id=${id} resolved_city_id=${resolvedCity?.id ?? null}`);

        if (!resolvedCity) {
          console.error(`[pending-save] pending_id=${id} fail reason=city_not_resolved`);
          return NextResponse.json({ error: `City could not be resolved: "${cityInput}".` }, { status: 400 });
        }

        patch.city_id = resolvedCity.id;
      }
    } else if ("city_id" in canonical) {
      if (canonical.city_id === null) {
        patch.city_id = null;
      } else {
        return NextResponse.json({ error: "city_id updates are no longer supported directly. Use city text input." }, { status: 400 });
      }
    }

    if (!("city" in body)) {
      console.info(`[pending-save] pending_id=${id} resolved_city_id=${patch.city_id ?? null}`);
    }

    for (const key of EXTRA_EDITABLE_FIELDS) {
      if (!(key in body)) {
        continue;
      }

      const value = body[key];
      if (!isAllowedExtraValue(value)) {
        return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
      }

      patch[key] = value;
    }

    const { data, error } = await ctx.supabase
      .from("pending_festivals")
      .update(patch)
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      const reason = error.message.split("\n")[0]?.slice(0, 180) ?? "unknown";
      console.error(`[pending-save] pending_id=${id} fail reason=${reason}`);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      console.error(`[pending-save] pending_id=${id} fail reason=no_row_updated`);
      return NextResponse.json({ error: "Pending festival was not updated." }, { status: 404 });
    }

    console.info(`[pending-save] pending_id=${id} db update ok`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    const reason = message.split("\n")[0]?.slice(0, 180) ?? "unexpected";
    console.error(`[pending-save] pending_id=${id} fail reason=${reason}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
