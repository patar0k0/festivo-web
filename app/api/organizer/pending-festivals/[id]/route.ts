import { NextResponse } from "next/server";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { mergeOccurrenceDatesWithRange } from "@/lib/festival/occurrenceDates";
import { pendingPatchFromCanonicalPartial } from "@/lib/festival/mappers";
import { canonicalPatchFromUnknown } from "@/lib/festival/validators";
import {
  assertCanEditOrganizerPending,
  getPortalAdminClient,
  getPortalSessionUser,
  loadPortalPendingFestival,
} from "@/lib/organizer/portal";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  const { id } = await params;

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const pending = await loadPortalPendingFestival(admin, id);
  if (!pending) {
    return NextResponse.json({ error: "Записът не е намерен." }, { status: 404 });
  }

  const gate = await assertCanEditOrganizerPending(admin, session.user.id, pending);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Невалидно тяло на заявката." }, { status: 400 });
  }

  if (
    rawBody === null ||
    typeof rawBody !== "object" ||
    Array.isArray(rawBody)
  ) {
    return NextResponse.json({ error: "Невалидно тяло на заявката." }, { status: 400 });
  }

  const body: Record<string, unknown> = rawBody as Record<string, unknown>;

  const safeBody: Record<string, unknown> = {};
  const allowKeys = [
    "title",
    "description",
    "category",
    "tags",
    "city",
    "city_name_display",
    "city_id",
    "location_name",
    "address",
    "latitude",
    "longitude",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
    "occurrence_dates",
    "website_url",
    "facebook_url",
    "instagram_url",
    "ticket_url",
    "price_range",
    "is_free",
    "slug",
    "hero_image",
  ] as const;

  for (const key of allowKeys) {
    if (key in body) {
      safeBody[key] = body[key];
    }
  }

  const parsed = canonicalPatchFromUnknown(safeBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const canonical = parsed.data;
  const patch: Record<string, unknown> = pendingPatchFromCanonicalPartial(canonical);

  if ("is_free" in body && typeof body.is_free === "boolean") {
    patch.is_free = body.is_free;
  }

  function optionalTrimmedUrlField(obj: Record<string, unknown>, key: "facebook_url" | "instagram_url") {
    if (!(key in obj)) return;
    const v = obj[key];
    if (v === null) {
      patch[key] = null;
      return;
    }
    if (typeof v === "string") {
      const t = v.trim();
      patch[key] = t || null;
    }
  }
  optionalTrimmedUrlField(body, "facebook_url");
  optionalTrimmedUrlField(body, "instagram_url");

  const cityForInput =
    typeof body.city_name_display === "string"
      ? body.city_name_display
      : typeof body.city === "string"
        ? body.city
        : "";

  if ("city_id" in canonical && canonical.city_id !== null) {
    patch.city_id = canonical.city_id;
  } else if (cityForInput.trim()) {
    const cityInput = normalizeSettlementInput(cityForInput);
    patch.city_name_display = cityInput || null;
    const cityResolution = await resolveOrCreateCityReference(admin, cityInput);
    patch.city_id = cityResolution?.city.id ?? null;
  } else if ("city_name_display" in canonical || "city" in body) {
    patch.city_id = null;
    patch.city_name_display = null;
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

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { data, error } = await admin.from("pending_festivals").update(patch).eq("id", id).eq("status", "pending").select("id").maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Записът не беше обновен." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
