import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { validateNoUnknownKeys } from "@/lib/api/strictBody";
import { ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS } from "@/lib/admin/patchAllowedKeys";
import { canonicalPatchFromUnknown } from "@/lib/festival/validators";
import { festivalPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { mergeOccurrenceDatesWithRange } from "@/lib/festival/occurrenceDates";
import { isAlreadyOurSupabaseHeroPublicUrl, rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { logAdminAction, pickFields } from "@/lib/admin/audit-log";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const strictValidation = validateNoUnknownKeys(body, ORGANIZER_FESTIVAL_PATCH_ALLOWED_KEYS);
  if (!strictValidation.ok) {
    return NextResponse.json(
      { error: `Непознато поле: ${strictValidation.unknownKeys.join(", ")}` },
      { status: 400 },
    );
  }

  const parsed = canonicalPatchFromUnknown(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const canonical = parsed.data;
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    ...festivalPatchFromCanonicalPartial(canonical),
    last_edited_by_organizer_at: nowIso,
    updated_at: nowIso,
  };

  if ("is_free" in body && typeof body.is_free === "boolean") {
    patch.is_free = body.is_free;
  }

  if ("description_short" in body) {
    const raw = body.description_short;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return NextResponse.json({ error: "Невалидно кратко описание." }, { status: 400 });
    }
    patch.description_short = raw === null || raw === undefined ? null : raw.trim() || null;
  }

  if ("hero_image" in canonical) {
    const heroVal = patch.hero_image;
    if (typeof heroVal === "string" && heroVal.trim()) {
      const inc = heroVal.trim();
      if (/^https?:\/\//i.test(inc) && !isAlreadyOurSupabaseHeroPublicUrl(inc)) {
        const timestamp = Date.now();
        const outcome = await rehostHeroImageIfRemote(
          admin,
          inc,
          (ext) => `festival-hero/organizer/festival-${id}-${timestamp}.${ext}`,
        );
        if (!outcome.ok) {
          return NextResponse.json({ error: `Основна снимка: ${outcome.error}` }, { status: 422 });
        }
        patch.hero_image = outcome.publicUrl;
        patch.image_url = outcome.publicUrl;
      }
    }
  }

  let selectedCitySlug: string | null = null;
  if ("city_name_display" in canonical) {
    const cityInputRaw = typeof canonical.city_name_display === "string" ? canonical.city_name_display : null;
    const cityInput = normalizeSettlementInput(cityInputRaw ?? "");
    if (!cityInput) {
      patch.city_id = null;
      patch.city = null;
    } else {
      const cityResolution = await resolveOrCreateCityReference(admin, cityInput);
      if (!cityResolution?.city) {
        return NextResponse.json({ error: "Градът не можа да бъде разпознат." }, { status: 400 });
      }
      patch.city_id = cityResolution.city.id;
      patch.city = cityResolution.city.slug;
      selectedCitySlug = cityResolution.city.slug;
    }
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

  const diffColumns = Object.keys(patch).filter((k) => k !== "updated_at" && k !== "last_edited_by_organizer_at");
  let beforeRow: Record<string, unknown> | null = null;
  if (diffColumns.length > 0) {
    const { data } = await admin.from("festivals").select(diffColumns.join(",")).eq("id", id).maybeSingle();
    beforeRow = (data ?? null) as Record<string, unknown> | null;
  }

  const { error: updateError } = await admin.from("festivals").update(patch).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let afterRow: Record<string, unknown> | null = null;
  if (diffColumns.length > 0) {
    const { data } = await admin.from("festivals").select(diffColumns.join(",")).eq("id", id).maybeSingle();
    afterRow = (data ?? null) as Record<string, unknown> | null;
  }

  try {
    await logAdminAction({
      actor_user_id: session.user.id,
      action: "festival.organizer_edited",
      entity_type: "festival",
      entity_id: id,
      route: "/api/organizer/festivals/[id]",
      method: "PATCH",
      details: {
        organizer_id: gate.organizerId,
        changed_fields: diffColumns,
        before: pickFields(beforeRow, diffColumns),
        after: pickFields(afterRow, diffColumns),
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_edited failed", { message });
  }

  return NextResponse.json({ ok: true, city_slug: selectedCitySlug });
}
