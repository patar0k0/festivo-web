import { NextResponse } from "next/server";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { slugify } from "@/lib/utils";
import { getPortalAdminClient, getPortalSessionUser, hasActiveOrganizerMembership } from "@/lib/organizer/portal";

type Body = {
  organizer_id?: string;
  title?: string;
  description?: string | null;
  city?: string;
  start_date?: string;
  end_date?: string | null;
  location_name?: string | null;
  website_url?: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  is_free?: boolean;
  tags?: string[];
};

function buildSlugSeed(title: string, pendingId: string) {
  const fromTitle = slugify(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return fromTitle || `festival-${pendingId}`;
}

export async function POST(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const organizerId = typeof body.organizer_id === "string" ? body.organizer_id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const cityRaw = typeof body.city === "string" ? body.city.trim() : "";
  const startDate = typeof body.start_date === "string" ? body.start_date.trim() : "";

  if (!organizerId || !title || !cityRaw || !startDate) {
    return NextResponse.json({ error: "Попълнете организатор, заглавие, град и начална дата." }, { status: 400 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const canManage = await hasActiveOrganizerMembership(admin, session.user.id, organizerId);
  if (!canManage) {
    return NextResponse.json({ error: "Нямате права за този организатор." }, { status: 403 });
  }

  const { data: orgRow, error: orgErr } = await admin
    .from("organizers")
    .select("id,name")
    .eq("id", organizerId)
    .eq("is_active", true)
    .maybeSingle();

  if (orgErr || !orgRow?.id) {
    return NextResponse.json({ error: "Организаторът не е намерен." }, { status: 404 });
  }

  const cityInput = normalizeSettlementInput(cityRaw);
  const cityResolution = await resolveOrCreateCityReference(admin, cityInput);
  if (!cityResolution?.city?.id) {
    return NextResponse.json({ error: "Градът не можа да бъде разпознат." }, { status: 400 });
  }

  const endDate = typeof body.end_date === "string" && body.end_date.trim() ? body.end_date.trim() : startDate;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean) : [];

  const pendingPayload = {
    title,
    slug: null as string | null,
    description: description || "",
    category: "festival",
    city_id: cityResolution.city.id,
    location_name: typeof body.location_name === "string" ? body.location_name.trim() || null : null,
    address: null as string | null,
    latitude: null as number | null,
    longitude: null as number | null,
    start_date: startDate,
    end_date: endDate,
    occurrence_dates: null,
    organizer_id: orgRow.id,
    organizer_name: orgRow.name,
    source_url: null as string | null,
    source_type: "organizer_portal",
    source_primary_url: null as string | null,
    source_count: null as number | null,
    evidence_json: null as unknown,
    verification_status: null as string | null,
    verification_score: null as number | null,
    extraction_version: null as string | null,
    website_url: typeof body.website_url === "string" ? body.website_url.trim() || null : null,
    ticket_url: typeof body.ticket_url === "string" ? body.ticket_url.trim() || null : null,
    price_range: typeof body.price_range === "string" ? body.price_range.trim() || null : null,
    is_free: typeof body.is_free === "boolean" ? body.is_free : true,
    hero_image: null as string | null,
    tags,
    status: "pending" as const,
    submitted_by_user_id: session.user.id,
    submission_source: "organizer_portal" as const,
  };

  const { data: inserted, error: insErr } = await admin.from("pending_festivals").insert(pendingPayload).select("id").single();

  if (insErr) {
    console.error("[api/organizer/pending-festivals] insert", insErr.message);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const slugSeed = buildSlugSeed(title, inserted.id);

  const { error: slugUpdErr } = await admin.from("pending_festivals").update({ slug: slugSeed }).eq("id", inserted.id);

  if (slugUpdErr) {
    console.warn("[api/organizer/pending-festivals] slug update", slugUpdErr.message);
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
