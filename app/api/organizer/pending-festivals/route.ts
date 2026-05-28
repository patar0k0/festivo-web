import { NextResponse } from "next/server";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { normalizeFestivalTimePair, parseHmInputToDbTime } from "@/lib/festival/festivalTimeFields";
import { normalizeFestivalSourceType } from "@/lib/festival/sourceType";
import {
  parseProgramDraftUnknown,
  programDraftHasContent,
  programDraftToPublishPayload,
} from "@/lib/festival/programDraft";
import { enqueueOrganizerPortalSubmissionEmails } from "@/lib/organizer/enqueuePendingFestivalSubmissionEmails";
import { getPortalAdminClient, getPortalSessionUser, hasActiveOrganizerMembership } from "@/lib/organizer/portal";
import { slugify } from "@/lib/utils";
import { normalizeCategory } from "@/lib/festival/mappers";

type Body = {
  organizer_id?: string;
  title?: string;
  description?: string | null;
  city?: string;
  start_date?: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location_name?: string | null;
  address?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  is_free?: boolean;
  category?: string | null;
  tags?: string[] | string;
  hero_image?: string | null;
  /** YouTube/Facebook URL — not a file upload. */
  video_url?: string | null;
  /** Array of hosted image URLs. */
  gallery_image_urls?: unknown;
  /** Optional schedule (days + program items) — shape from `lib/festival/programDraft`. */
  program_draft?: unknown;
  /** When `"draft"`, creates a persisted preview row without moderation emails. */
  status?: string;
};

function normalizeGalleryUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (!/^https?:\/\//i.test(trimmed)) continue;
    if (trimmed.length > 2000) continue;
    out.push(trimmed);
    if (out.length >= 24) break; // hard cap to avoid bloated payloads
  }
  return out;
}

function optionalTrimmedUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t || null;
}

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

  const endDate = typeof body.end_date === "string" && body.end_date.trim() ? body.end_date.trim() : null;
  const timePair = normalizeFestivalTimePair(parseHmInputToDbTime(body.start_time), parseHmInputToDbTime(body.end_time));
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const tags =
    Array.isArray(body.tags)
      ? body.tags.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean)
      : typeof body.tags === "string"
        ? body.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
  const category = normalizeCategory(typeof body.category === "string" ? body.category : "") ?? "festival";

  const wantsDraft = body.status === "draft";
  const recordStatus = wantsDraft ? ("draft" as const) : ("pending" as const);

  // Optional program draft (days + items). Reject malformed; accept empty silently.
  let programDraftForInsert: unknown = null;
  if (body.program_draft !== undefined && body.program_draft !== null) {
    const parsed = parseProgramDraftUnknown(body.program_draft);
    if (!parsed.ok) {
      return NextResponse.json({ error: `Програма: ${parsed.error}` }, { status: 400 });
    }
    if (programDraftHasContent(parsed.value)) {
      programDraftForInsert = programDraftToPublishPayload(parsed.value);
    }
  }

  const pendingPayload = {
    title,
    slug: null as string | null,
    description: description || "",
    category,
    city_id: cityResolution.city.id,
    city_name_display: cityRaw || null,
    location_name: typeof body.location_name === "string" ? body.location_name.trim() || null : null,
    address: typeof body.address === "string" ? body.address.trim() || null : null,
    latitude: null as number | null,
    longitude: null as number | null,
    start_date: startDate,
    end_date: endDate,
    start_time: timePair.start_time,
    end_time: timePair.end_time,
    occurrence_dates: null,
    organizer_id: orgRow.id,
    organizer_name: orgRow.name,
    source_url: null as string | null,
    source_type: normalizeFestivalSourceType("organizer_portal"),
    source_primary_url: null as string | null,
    // Production DB has NOT NULL constraint on several research-pipeline columns
    // (source_count, verification_score, evidence_json) despite migrations allowing
    // null. For organizer-submitted rows we provide sane defaults explicitly so
    // PostgreSQL doesn't 23502 on INSERT:
    //   - source_count = 1 (organizer = single source)
    //   - verification_score = 0 (low confidence, admin will review)
    //   - evidence_json = {} (no automated evidence collected for manual submissions)
    source_count: 1,
    evidence_json: {} as Record<string, unknown>,
    verification_status: "needs_review" as const,
    verification_score: 0,
    extraction_version: null as string | null,
    website_url: optionalTrimmedUrl(body.website_url),
    facebook_url: optionalTrimmedUrl(body.facebook_url),
    instagram_url: optionalTrimmedUrl(body.instagram_url),
    ticket_url: optionalTrimmedUrl(body.ticket_url),
    price_range: typeof body.price_range === "string" ? body.price_range.trim() || null : null,
    is_free: typeof body.is_free === "boolean" ? body.is_free : true,
    hero_image: optionalTrimmedUrl(body.hero_image),
    video_url: optionalTrimmedUrl(body.video_url),
    gallery_image_urls: normalizeGalleryUrls(body.gallery_image_urls),
    tags,
    program_draft: programDraftForInsert,
    status: recordStatus,
    submitted_by_user_id: session.user.id,
    submission_source: "organizer_portal" as const,
  };

  console.info(
    `[api/organizer/pending-festivals] source_type input="organizer_portal" normalized="${String(pendingPayload.source_type ?? "")}"`
  );

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

  if (!wantsDraft) {
    void enqueueOrganizerPortalSubmissionEmails(admin, {
      pendingId: inserted.id,
      userId: session.user.id,
      title,
      cityDisplay: cityRaw || null,
      startDate,
    });
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
