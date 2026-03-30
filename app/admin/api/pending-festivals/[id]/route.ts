import { NextResponse } from "next/server";
import { isAlreadyOurSupabaseHeroPublicUrl, rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { pendingPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { mergeOccurrenceDatesWithRange } from "@/lib/festival/occurrenceDates";
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
  "video_url",
  "gallery_image_urls",
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

    if ("hero_image" in canonical) {
      const heroVal = patch.hero_image;
      if (typeof heroVal === "string" && heroVal.trim()) {
        const inc = heroVal.trim();
        if (/^https?:\/\//i.test(inc) && !isAlreadyOurSupabaseHeroPublicUrl(inc)) {
          const { data: currentHero } = await ctx.supabase
            .from("pending_festivals")
            .select("hero_image, hero_image_original_url")
            .eq("id", id)
            .maybeSingle();

          const originalMatch =
            Boolean(currentHero?.hero_image_original_url?.trim() === inc) &&
            typeof currentHero?.hero_image === "string" &&
            currentHero.hero_image.length > 0;

          if (originalMatch) {
            patch.hero_image = currentHero.hero_image;
            patch.hero_image_source = "url_import";
            patch.hero_image_original_url = inc;
          } else {
            try {
              const supabaseAdmin = createSupabaseAdmin();
              const timestamp = Date.now();
              const outcome = await rehostHeroImageIfRemote(supabaseAdmin, inc, (ext) => `festival-hero/manual/${id}-${timestamp}.${ext}`);
              if (!outcome.ok) {
                return NextResponse.json({ error: `Hero image: ${outcome.error}` }, { status: 422 });
              }
              patch.hero_image = outcome.publicUrl;
              if (outcome.originalUrl) {
                patch.hero_image_source = "url_import";
                patch.hero_image_original_url = outcome.originalUrl;
              } else {
                patch.hero_image_source = "manual_upload";
                patch.hero_image_original_url = null;
              }
            } catch (heroImportError) {
              const message = heroImportError instanceof Error ? heroImportError.message : "Hero image import failed.";
              return NextResponse.json({ error: message }, { status: 500 });
            }
          }
        }
      }
    }

    if ("is_free" in body && typeof body.is_free === "boolean") {
      patch.is_free = body.is_free;
    }

    if ("city_id" in canonical && canonical.city_id !== null) {
      patch.city_id = canonical.city_id;
      console.info(`[pending-save] pending_id=${id} explicit_city_id=${canonical.city_id}`);
    } else if ("city_name_display" in canonical) {
      const cityInputRaw = typeof canonical.city_name_display === "string" ? canonical.city_name_display : "";
      const cityInput = normalizeSettlementInput(cityInputRaw);
      patch.city_name_display = cityInput || null;

      if (!cityInput) {
        patch.city_id = null;
      } else {
        const cityResolution = await resolveOrCreateCityReference(ctx.supabase, cityInput);
        console.info(
          `[pending-save] pending_id=${id} resolved_city_id=${cityResolution?.city.id ?? null} city_created=${cityResolution?.created ? "true" : "false"}`
        );
        patch.city_id = cityResolution?.city.id ?? null;
      }
    } else if ("city_id" in canonical && canonical.city_id === null) {
      patch.city_id = null;
    }

    if (!("city" in body)) {
      console.info(`[pending-save] pending_id=${id} resolved_city_id=${patch.city_id ?? null}`);
    }

    if ("occurrence_dates" in body) {
      const merged = mergeOccurrenceDatesWithRange({
        occurrence_days: body.occurrence_dates,
        start_date: typeof body.start_date === "string" ? body.start_date : (typeof patch.start_date === "string" ? patch.start_date : null),
        end_date: typeof body.end_date === "string" ? body.end_date : (typeof patch.end_date === "string" ? patch.end_date : null),
      });
      patch.occurrence_dates = merged.occurrence_dates;
      patch.start_date = merged.start_date;
      patch.end_date = merged.end_date;
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
