import { NextResponse } from "next/server";
import { isAlreadyOurSupabaseHeroPublicUrl, rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { festivalPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { canonicalPatchFromUnknown } from "@/lib/festival/validators";
import { normalizeOrganizerIds, syncFestivalOrganizers } from "@/lib/festivalOrganizers";
import { mergeOccurrenceDatesWithRange } from "@/lib/festival/occurrenceDates";
import { scheduleFestivalUpdateNotifications } from "@/lib/notifications/triggers";
import { consumePromotionCredit, getRemainingPromotionCredits, hasActiveVip } from "@/lib/monetization";


type SaveResponse = {
  ok: true;
  city_created: boolean;
  city: { id: number | null; name_bg: string | null; slug: string | null };
  displayed_city: string | null;
  hero_image?: string | null;
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


function parseOrganizerIds(value: unknown): string[] | null {
  if (value === null || typeof value === "undefined") return [];
  if (!Array.isArray(value)) return null;
  return normalizeOrganizerIds(value);
}

function parseOrganizerId(value: unknown): string[] | null {
  if (value === null || value === undefined || value === "") return [];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return [];
  return [trimmed];
}

function parseIntegerOrNull(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

function parseDatetimeStringOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

    const { data: beforeFestival } = await ctx.supabase
      .from("festivals")
      .select(
        "start_date,end_date,start_time,end_time,city,city_id,address,title,occurrence_dates,status,promotion_status,promotion_started_at,promotion_expires_at,promotion_rank,organizer_id"
      )
      .eq("id", id)
      .maybeSingle();

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

    let responseHeroImage: string | null | undefined;

    if ("hero_image" in canonical) {
      const heroVal = patch.hero_image;
      if (typeof heroVal === "string" && heroVal.trim()) {
        const inc = heroVal.trim();
        if (/^https?:\/\//i.test(inc) && !isAlreadyOurSupabaseHeroPublicUrl(inc)) {
          try {
            const supabaseAdmin = createSupabaseAdmin();
            const timestamp = Date.now();
            const outcome = await rehostHeroImageIfRemote(supabaseAdmin, inc, (ext) => `festival-hero/manual/festival-${id}-${timestamp}.${ext}`);
            if (!outcome.ok) {
              return NextResponse.json({ error: `Hero image: ${outcome.error}` }, { status: 422 });
            }
            patch.hero_image = outcome.publicUrl;
            patch.image_url = outcome.publicUrl;
            responseHeroImage = outcome.publicUrl;
          } catch (heroImportError) {
            const message = heroImportError instanceof Error ? heroImportError.message : "Hero image import failed.";
            return NextResponse.json({ error: message }, { status: 500 });
          }
        }
      }
    }

    if ("is_free" in body && typeof body.is_free === "boolean") {
      patch.is_free = body.is_free;
    }

    if ("is_verified" in body && typeof body.is_verified === "boolean") {
      patch.is_verified = body.is_verified;
    }

    if ("promotion_status" in body) {
      if (body.promotion_status === "normal" || body.promotion_status === "promoted") {
        patch.promotion_status = body.promotion_status;
      } else {
        return NextResponse.json({ error: "Invalid promotion_status" }, { status: 400 });
      }
    }

    const beforePromotionStatus =
      beforeFestival && typeof beforeFestival === "object" && "promotion_status" in beforeFestival
        ? (beforeFestival.promotion_status as string | null)
        : null;
    const afterPromotionStatus =
      typeof patch.promotion_status === "string" ? patch.promotion_status : beforePromotionStatus;
    const shouldConsumePromotionCredit = beforePromotionStatus === "normal" && afterPromotionStatus === "promoted";

    if ("promotion_started_at" in body) {
      const parsedPromotionStartedAt = parseDatetimeStringOrNull(body.promotion_started_at);
      if (parsedPromotionStartedAt === undefined) {
        return NextResponse.json({ error: "Invalid promotion_started_at" }, { status: 400 });
      }
      patch.promotion_started_at = parsedPromotionStartedAt;
    }

    if ("promotion_expires_at" in body) {
      const parsedPromotionExpiresAt = parseDatetimeStringOrNull(body.promotion_expires_at);
      if (parsedPromotionExpiresAt === undefined) {
        return NextResponse.json({ error: "Invalid promotion_expires_at" }, { status: 400 });
      }
      patch.promotion_expires_at = parsedPromotionExpiresAt;
    }

    if ("promotion_rank" in body) {
      const parsedPromotionRank = parseIntegerOrNull(body.promotion_rank);
      if (parsedPromotionRank === undefined) {
        return NextResponse.json({ error: "Invalid promotion_rank" }, { status: 400 });
      }
      patch.promotion_rank = parsedPromotionRank;
    }

    let organizerIdsFromBody: string[] | null = null;

    if ("organizer_ids" in body) {
      const organizerIds = parseOrganizerIds(body.organizer_ids);
      if (organizerIds === null) {
        return NextResponse.json({ error: "Invalid organizer_ids" }, { status: 400 });
      }
      organizerIdsFromBody = organizerIds;
    } else if ("organizer_id" in body) {
      const organizerId = parseOrganizerId(body.organizer_id);
      if (organizerId === null) {
        return NextResponse.json({ error: "Invalid organizer_id" }, { status: 400 });
      }
      organizerIdsFromBody = organizerId;
    }

    if (organizerIdsFromBody !== null) {
      const primaryOrganizerId = organizerIdsFromBody[0] ?? null;
      patch.organizer_id = primaryOrganizerId;

      if (primaryOrganizerId) {
        const { data: organizer, error: organizerError } = await ctx.supabase
          .from("organizers")
          .select("name")
          .eq("id", primaryOrganizerId)
          .maybeSingle<{ name: string }>();

        if (organizerError) {
          return NextResponse.json({ error: organizerError.message }, { status: 500 });
        }

        patch.organizer_name = organizer?.name ?? patch.organizer_name ?? null;
      }
    }

    let vipOrganizerForCreditConsumption: {
      id: string;
      plan: string | null;
      plan_started_at: string | null;
      plan_expires_at: string | null;
      included_promotions_per_year: number | null;
    } | null = null;

    if (shouldConsumePromotionCredit) {
      const beforeOrganizerId =
        beforeFestival && typeof beforeFestival === "object" && "organizer_id" in beforeFestival
          ? (beforeFestival.organizer_id as string | null)
          : null;
      const organizerIdForPromotion =
        typeof patch.organizer_id === "string" && patch.organizer_id.trim().length > 0
          ? patch.organizer_id
          : beforeOrganizerId;

      if (organizerIdForPromotion) {
        const { data: organizer, error: organizerError } = await ctx.supabase
          .from("organizers")
          .select("id,plan,plan_started_at,plan_expires_at,included_promotions_per_year")
          .eq("id", organizerIdForPromotion)
          .maybeSingle<{
            id: string;
            plan: string | null;
            plan_started_at: string | null;
            plan_expires_at: string | null;
            included_promotions_per_year: number | null;
          }>();

        if (organizerError) {
          return NextResponse.json({ error: organizerError.message }, { status: 500 });
        }

        if (organizer && hasActiveVip(organizer)) {
          const creditYear = new Date().getUTCFullYear();
          const remainingCredits = await getRemainingPromotionCredits(ctx.supabase, organizer, creditYear);
          if (remainingCredits <= 0) {
            return NextResponse.json({ error: "No remaining VIP promotion credits for this year." }, { status: 409 });
          }
          vipOrganizerForCreditConsumption = organizer;
        }
      }
    }

    const hasCityInputField = "city_name_display" in canonical;
    const cityInputRaw = typeof canonical.city_name_display === "string" ? canonical.city_name_display : null;
    const hasCityInput = hasCityInputField;
    const hasCityId = "city_id" in body;
    let selectedCity: CityRow | null = null;
    let cityCreated = false;

    if (hasCityId) {
      const cityId = parseCityId(body.city_id);
      if (Number.isNaN(cityId)) {
        return NextResponse.json({ error: "Invalid city_id" }, { status: 400 });
      }

      if (cityId === null) {
        if (hasCityInput) {
          const cityInput = normalizeSettlementInput(cityInputRaw ?? "");

          if (!cityInput) {
            patch.city_id = null;
            patch.city = null;
          } else {
            const cityResolution = await resolveOrCreateCityReference(ctx.supabase, cityInput);
            selectedCity = cityResolution?.city ?? null;
            cityCreated = cityResolution?.created ?? false;
            patch.city_id = cityResolution?.city.id ?? null;
            patch.city = cityResolution?.city.slug ?? cityInput;
          }
        } else {
          patch.city_id = null;
          patch.city = null;
        }
      } else {
        const city = await findCityById(ctx, cityId);

        if (!city?.slug) {
          return NextResponse.json({ error: "City not found" }, { status: 404 });
        }

        selectedCity = city;
        patch.city_id = cityId;
        patch.city = city.slug;
      }
    } else if (hasCityInput) {
      const cityInput = normalizeSettlementInput(cityInputRaw ?? "");

      if (!cityInput) {
        patch.city_id = null;
        patch.city = null;
      } else {
        const cityResolution = await resolveOrCreateCityReference(ctx.supabase, cityInput);

        if (cityResolution?.city) {
          selectedCity = cityResolution.city;
          cityCreated = cityResolution.created;
          patch.city_id = cityResolution.city.id;
          patch.city = cityResolution.city.slug;
        } else {
          patch.city_id = null;
          patch.city = null;
        }

        console.info(
          `[festival-save] id=${id} city_input="${cityInputRaw}" resolved_city_id=${cityResolution?.city.id ?? "null"} city_created=${cityResolution?.created ? "true" : "false"}`
        );
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

    const { error } = await ctx.supabase.from("festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (shouldConsumePromotionCredit && vipOrganizerForCreditConsumption) {
      const creditYear = new Date().getUTCFullYear();
      const consumed = await consumePromotionCredit(ctx.supabase, vipOrganizerForCreditConsumption, creditYear);
      if (!consumed) {
        const rollbackPatch: Record<string, unknown> = {
          promotion_status: beforePromotionStatus,
        };
        if (Object.prototype.hasOwnProperty.call(patch, "promotion_started_at")) {
          rollbackPatch.promotion_started_at =
            beforeFestival && typeof beforeFestival === "object" && "promotion_started_at" in beforeFestival
              ? (beforeFestival.promotion_started_at as string | null)
              : null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, "promotion_expires_at")) {
          rollbackPatch.promotion_expires_at =
            beforeFestival && typeof beforeFestival === "object" && "promotion_expires_at" in beforeFestival
              ? (beforeFestival.promotion_expires_at as string | null)
              : null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, "promotion_rank")) {
          rollbackPatch.promotion_rank =
            beforeFestival && typeof beforeFestival === "object" && "promotion_rank" in beforeFestival
              ? (beforeFestival.promotion_rank as number | null)
              : null;
        }

        const { error: rollbackError } = await ctx.supabase.from("festivals").update(rollbackPatch).eq("id", id);
        if (rollbackError) {
          return NextResponse.json(
            {
              error:
                "VIP promotion credit consumption failed after update, and automatic rollback failed. Festival promotion may need manual admin correction.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: "No remaining VIP promotion credits for this year. Festival promotion update was rolled back." },
          { status: 409 }
        );
      }
    }

    const { data: afterFestival } = await ctx.supabase
      .from("festivals")
      .select("start_date,end_date,start_time,end_time,city,city_id,address,title,occurrence_dates,status")
      .eq("id", id)
      .maybeSingle();

    void scheduleFestivalUpdateNotifications(
      id,
      (beforeFestival ?? null) as Record<string, unknown> | null,
      (afterFestival ?? null) as Record<string, unknown> | null,
    ).catch((err) => console.warn("[notifications] scheduleFestivalUpdateNotifications", err));

    if (organizerIdsFromBody !== null) {
      try {
        await syncFestivalOrganizers(ctx.supabase, id, organizerIdsFromBody);
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "Failed to sync festival organizers";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    const response: SaveResponse = {
      ok: true,
      city_created: cityCreated,
      city: selectedCity
        ? { id: selectedCity.id, name_bg: selectedCity.name_bg, slug: selectedCity.slug }
        : { id: null, name_bg: null, slug: typeof patch.city === "string" ? patch.city : null },
      displayed_city: cityDisplay || null,
      ...(responseHeroImage !== undefined ? { hero_image: responseHeroImage } : {}),
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
