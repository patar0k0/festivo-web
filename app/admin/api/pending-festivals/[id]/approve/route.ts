import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeSettlementInput, resolveOrCreateCityReference } from "@/lib/admin/resolveCityReference";
import { slugify } from "@/lib/utils";
import { canonicalFromPending, festivalPatchFromCanonical } from "@/lib/festival/mappers";
import { canonicalFromUnknown } from "@/lib/festival/validators";
import { resolveOrCreateOrganizerId } from "@/lib/admin/organizers";
import type { PendingOrganizerEntry } from "@/lib/admin/pendingOrganizerEntries";
import { pendingRowToOrganizerEntries } from "@/lib/admin/pendingOrganizerEntries";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncFestivalOrganizers } from "@/lib/festivalOrganizers";
import { scheduleNewFestivalFollowCityJobs } from "@/lib/notifications/triggers";

type CityRow = {
  id: number;
  slug: string;
  name_bg: string;
};

type ApprovePayload = {
  city?: string | null;
  tags?: unknown;
};

type PendingFestivalRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  category: string | null;
  city_id: number | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  occurrence_dates: unknown;
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_entries: unknown;
  source_url: string | null;
  source_type: string | null;
  source_primary_url: string | null;
  source_count: number | null;
  evidence_json: unknown;
  verification_status: string | null;
  verification_score: number | null;
  extraction_version: string | null;
  website_url: string | null;
  ticket_url: string | null;
  price_range: string | null;
  is_free: boolean | null;
  hero_image: string | null;
  tags: unknown;
  status: "pending" | "approved" | "rejected";
};

const PENDING_APPROVE_SELECT =
  "id,title,slug,description,category,city_id,location_name,address,latitude,longitude,start_date,end_date,occurrence_dates,organizer_id,organizer_name,organizer_entries,source_url,source_type,source_primary_url,source_count,evidence_json,verification_status,verification_score,extraction_version,website_url,ticket_url,price_range,is_free,hero_image,tags,status";

async function resolveOrganizerIdsForPublish(
  adminSupabase: SupabaseClient,
  serviceSupabase: SupabaseClient,
  entries: PendingOrganizerEntry[],
): Promise<{ ids: string[]; primaryDisplayName: string | null }> {
  const orderedIds: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.organizer_id) {
      const { data: orgRow, error: orgErr } = await adminSupabase
        .from("organizers")
        .select("id,name")
        .eq("id", entry.organizer_id)
        .eq("is_active", true)
        .maybeSingle();

      if (orgErr) {
        throw new Error(`Organizer lookup failed: ${orgErr.message}`);
      }

      if (orgRow?.id && !seen.has(orgRow.id)) {
        seen.add(orgRow.id);
        orderedIds.push(orgRow.id);
      }
      continue;
    }

    const rawName = entry.name.trim();
    if (!rawName || rawName === "—") continue;

    const resolved = await resolveOrCreateOrganizerId(serviceSupabase, rawName);
    if (resolved.organizerId && !seen.has(resolved.organizerId)) {
      seen.add(resolved.organizerId);
      orderedIds.push(resolved.organizerId);
    }
  }

  let primaryDisplayName: string | null = null;
  if (orderedIds.length > 0) {
    const { data: firstOrg } = await adminSupabase.from("organizers").select("name").eq("id", orderedIds[0]).maybeSingle();
    primaryDisplayName = firstOrg?.name ?? null;
  }

  return { ids: orderedIds, primaryDisplayName };
}

const REQUIRED_PENDING_CANONICAL_FIELDS: (keyof PendingFestivalRow)[] = [
  "title",
  "slug",
  "description",
  "category",
  "tags",
  "city_id",
  "location_name",
  "address",
  "latitude",
  "longitude",
  "start_date",
  "end_date",
  "organizer_name",
  "hero_image",
  "website_url",
  "ticket_url",
  "price_range",
  "source_url",
  "source_type",
  "status",
];

type IngestJobRow = {
  source_type: string;
};

type ApiErrorResponse = {
  ok: false;
  error: string;
};

function buildBaseSlug(slug: string | null, title: string, pendingId: string) {
  const trimmedSlug = (slug ?? "").trim();
  const fromTitle = slugify(title)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const baseSlug = trimmedSlug || fromTitle;
  return baseSlug || `festival-${pendingId}`;
}

function fail(pendingId: string, reason: string, status: number, error: string) {
  console.error(`[pending-approve] pending_id=${pendingId} fail reason=${reason}`);
  return NextResponse.json<ApiErrorResponse>({ ok: false, error }, { status });
}

function mapFestivalSourceType(rawSourceType: string | null) {
  if (!rawSourceType) return null;

  if (rawSourceType === "facebook_event") {
    return "facebook";
  }

  return rawSourceType;
}

function findMissingCanonicalField(row: PendingFestivalRow): keyof PendingFestivalRow | null {
  for (const field of REQUIRED_PENDING_CANONICAL_FIELDS) {
    if (typeof row[field] === "undefined") {
      return field;
    }
  }

  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const adminCtx = ctx;

  async function isSlugTaken(slug: string) {
    const { data, error } = await adminCtx.supabase.from("festivals").select("id").eq("slug", slug).limit(1);

    if (error) {
      throw new Error(`Approve failed during slug check: ${error.message}`);
    }

    return Boolean(data && data.length > 0);
  }

  async function findCityById(cityId: number) {
    const { data, error } = await adminCtx.supabase.from("cities").select("id,slug,name_bg").eq("id", cityId).maybeSingle();

    if (error) {
      throw new Error(`Approve failed during city lookup: ${error.message}`);
    }

    return data as CityRow | null;
  }

  let pendingIdForLog = "unknown";

  try {
    const { id } = await params;
    pendingIdForLog = id;
    console.info(`[pending-approve] pending_id=${id} start`);

    const body = (await request.json().catch(() => null)) as ApprovePayload | null;
    const hasCityOverride = body && "city" in body;
    const hasTagsOverride = body && "tags" in body;

    let overrideTags: string[] | null = null;
    if (hasTagsOverride) {
      if (Array.isArray(body?.tags)) {
        overrideTags = body.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
      } else if (body?.tags === null) {
        overrideTags = [];
      } else {
        return fail(id, "invalid_tags", 400, "Invalid tags payload.");
      }
    }

    const { data: pending, error: pendingError } = await adminCtx.supabase
      .from("pending_festivals")
      .select(PENDING_APPROVE_SELECT)
      .eq("id", id)
      .maybeSingle<PendingFestivalRow>();

    if (pendingError) {
      return fail(id, "pending_lookup_error", 500, `Failed to load pending festival: ${pendingError.message}`);
    }

    if (!pending) {
      return fail(id, "not_found", 404, "Pending festival not found.");
    }

    if (pending.status !== "pending") {
      return fail(id, "not_pending", 409, `Festival already reviewed with status '${pending.status}'.`);
    }

    const missingField = findMissingCanonicalField(pending);
    if (missingField) {
      return fail(id, "pending_missing_field", 500, `Pending festival is missing required field: ${missingField}`);
    }

    console.info(`[pending-approve] pending_id=${id} fetched pending row`);

    const canonicalPending = canonicalFromPending(pending);

    const canonicalApprovedResult = canonicalFromUnknown({
      ...canonicalPending,
      tags: overrideTags ?? canonicalPending.tags,
      city_name_display: hasCityOverride && typeof body?.city === "string" ? body.city : canonicalPending.city_name_display,
    });

    if (!canonicalApprovedResult.ok) {
      return fail(id, "invalid_canonical_payload", 400, canonicalApprovedResult.error);
    }

    const canonicalApproved = canonicalApprovedResult.data;

    let cityInput = "";
    const postedCity = hasCityOverride && typeof body?.city === "string" ? body.city : "";
    if (postedCity) {
      cityInput = normalizeSettlementInput(postedCity);
    } else if (pending.city_id != null) {
      cityInput = String(pending.city_id);
    }

    if (!cityInput) {
      return fail(id, "missing_city", 400, "City is required before approving this festival.");
    }

    const cityResolution = await resolveOrCreateCityReference(adminCtx.supabase, cityInput);
    if (!cityResolution?.city) {
      return fail(id, "city_not_resolved", 400, `City could not be resolved: "${cityInput}".`);
    }

    const cityById = await findCityById(cityResolution.city.id);
    if (!cityById?.slug) {
      return fail(id, "resolved_city_not_found", 400, "Resolved city is missing canonical data.");
    }

    const cityId = cityById.id;
    const cityText = cityById.slug;

    console.info(`[pending-approve] pending_id=${id} city input="${cityInput}" resolved_city_id=${cityId} city_created=${cityResolution.created ? "true" : "false"}`);

    const finalTags = canonicalApproved.tags;
    console.info(`[pending-approve] pending_id=${id} tags_count=${finalTags.length} tags_mode=column`);

    if (pending.source_url) {
      const { data: existingBySource, error: existingBySourceError } = await adminCtx.supabase
        .from("festivals")
        .select("id")
        .eq("source_url", pending.source_url)
        .limit(1);

      if (existingBySourceError) {
        return fail(id, "source_url_check_failed", 500, `Failed to check source_url conflict: ${existingBySourceError.message}`);
      }

      if (existingBySource && existingBySource.length > 0) {
        return fail(id, "source_url_conflict", 409, "source_url conflict");
      }
    }

    const baseSlug = buildBaseSlug(pending.slug, pending.title, pending.id);

    let finalSlug = baseSlug;
    let slugAvailable = !(await isSlugTaken(finalSlug));

    for (let i = 2; !slugAvailable && i <= 50; i += 1) {
      finalSlug = `${baseSlug}-${i}`;
      slugAvailable = !(await isSlugTaken(finalSlug));
    }

    if (!slugAvailable) {
      return fail(id, "slug_conflict", 409, "slug conflict");
    }

    if (!pending.start_date) {
      return fail(id, "missing_start_date", 400, "missing start_date");
    }

    const normalizedAddress = normalizeSettlementInput(canonicalApproved.address ?? "");

    let rawSourceType: string | null = null;
    if (pending.source_url) {
      const { data: ingestJob, error: ingestJobError } = await adminCtx.supabase
        .from("ingest_jobs")
        .select("source_type")
        .eq("source_url", pending.source_url)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<IngestJobRow>();

      if (ingestJobError) {
        return fail(id, "ingest_job_lookup_failed", 500, `Failed to load ingest source_type: ${ingestJobError.message}`);
      }

      rawSourceType = ingestJob?.source_type ?? null;
    }
    if (!rawSourceType && pending.source_type) {
      rawSourceType = pending.source_type;
    }

    const mappedSourceType = mapFestivalSourceType(rawSourceType);

    let organizerId: string | null = null;
    let organizerDisplayName: string | null = canonicalApproved.organizer_name ?? null;
    let publishedOrganizerIds: string[] = [];

    const entries = pendingRowToOrganizerEntries(pending);
    const serviceSupabase = createSupabaseAdmin();

    if (entries.length > 0) {
      try {
        const resolved = await resolveOrganizerIdsForPublish(adminCtx.supabase, serviceSupabase, entries);
        publishedOrganizerIds = resolved.ids;
        organizerId = publishedOrganizerIds[0] ?? null;
        organizerDisplayName = resolved.primaryDisplayName ?? organizerDisplayName;
        console.info(`[pending-approve] pending_id=${id} organizer_entries resolved count=${publishedOrganizerIds.length}`);
      } catch (resolveErr) {
        const msg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
        return fail(id, "organizer_resolve_failed", 500, msg);
      }
    }

    if (entries.length === 0 && pending.organizer_id) {
      const { data: linkedOrg, error: linkedOrgError } = await adminCtx.supabase
        .from("organizers")
        .select("id,name")
        .eq("id", pending.organizer_id)
        .eq("is_active", true)
        .maybeSingle();

      if (linkedOrgError) {
        return fail(id, "organizer_lookup_failed", 500, `Organizer lookup failed: ${linkedOrgError.message}`);
      }

      if (linkedOrg?.id) {
        organizerId = linkedOrg.id;
        publishedOrganizerIds = [linkedOrg.id];
        organizerDisplayName = linkedOrg.name ?? organizerDisplayName;
        console.info(`[pending-approve] pending_id=${id} organizer from pending.organizer_id=${organizerId}`);
      }
    }

    if (publishedOrganizerIds.length === 0 && canonicalApproved.organizer_name) {
      const organizerResolution = await resolveOrCreateOrganizerId(serviceSupabase, canonicalApproved.organizer_name);
      organizerId = organizerResolution.organizerId;
      organizerDisplayName = organizerResolution.organizerName;
      if (organizerId) {
        publishedOrganizerIds = [organizerId];
      }
      console.info(
        `[pending-approve] pending_id=${id} organizer resolution organizer_id=${organizerId ?? "null"} created=${organizerResolution.created ? "true" : "false"}`
      );
    }

    console.info(`[pending-approve] pending_id=${id} source_type raw="${rawSourceType ?? ""}" mapped="${mappedSourceType ?? ""}"`);
    console.info(
      `[pending-approve] pending_id=${id} publish source fields=${JSON.stringify({
        title: pending.title,
        slug: pending.slug,
        description: pending.description,
        city_id: pending.city_id,
        location_name: pending.location_name,
        latitude: pending.latitude,
        longitude: pending.longitude,
        start_date: pending.start_date,
        end_date: pending.end_date,
        organizer_name: pending.organizer_name,
        source_url: pending.source_url,
        source_type: pending.source_type,
        source_primary_url: pending.source_primary_url,
        source_count: pending.source_count,
        evidence_json: pending.evidence_json,
        verification_status: pending.verification_status,
        verification_score: pending.verification_score,
        extraction_version: pending.extraction_version,
        category: pending.category,
        website_url: pending.website_url,
        ticket_url: pending.ticket_url,
        price_range: pending.price_range,
        is_free: pending.is_free,
        hero_image: pending.hero_image,
        tags: pending.tags,
      })}`,
    );

    const festivalPatch = festivalPatchFromCanonical(canonicalApproved);
    const insertPayload = {
      ...festivalPatch,
      occurrence_dates: pending.occurrence_dates ?? null,
      slug: finalSlug,
      city: cityText || null,
      city_id: cityId,
      address: normalizedAddress || null,
      category: canonicalApproved.category ?? "festival",
      source_type: mappedSourceType,
      source_primary_url: pending.source_primary_url,
      source_count: pending.source_count,
      evidence_json: pending.evidence_json,
      verification_status: pending.verification_status,
      verification_score: pending.verification_score,
      extraction_version: pending.extraction_version,
      is_free: pending.is_free ?? true,
      organizer_id: organizerId,
      organizer_name: organizerDisplayName,
      tags: finalTags,
      status: "verified",
      is_verified: true,
      updated_at: new Date().toISOString(),
    };

    console.info(`[pending-approve] pending_id=${id} festivals insert payload keys=${Object.keys(insertPayload).join(",")}`);

    const { data: insertedFestival, error: insertError } = await adminCtx.supabase.from("festivals").insert(insertPayload).select("id").maybeSingle();

    if (insertError) {
      if (insertError.code === "23505") {
        const shortMessage = insertError.message.includes("source_url") ? "source_url conflict" : "slug conflict";
        return fail(id, "festivals_insert_failed", 409, shortMessage);
      }

      return fail(id, "festivals_insert_failed", 500, `festivals insert failed: ${insertError.message}`);
    }

    if (!insertedFestival?.id) {
      return fail(id, "festivals_insert_missing_id", 500, "festivals insert failed");
    }

    console.info(`[pending-approve] pending_id=${id} published festival_id=${insertedFestival.id}`);

    try {
      await syncFestivalOrganizers(adminCtx.supabase, insertedFestival.id, publishedOrganizerIds);
    } catch (syncError) {
      await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      const message = syncError instanceof Error ? syncError.message : "festival_organizers sync failed";
      return fail(id, "festival_organizers_sync_failed", 500, message);
    }

    const { data: reviewRow, error: reviewError } = await adminCtx.supabase
      .from("pending_festivals")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminCtx.user.id,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (reviewError) {
      await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      return fail(id, "pending_status_update_failed", 500, `pending status update failed: ${reviewError.message}`);
    }

    if (!reviewRow) {
      await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      return fail(id, "pending_status_not_updated", 409, "pending status update failed");
    }

    console.info(`[pending-approve] pending_id=${id} pending status updated=approved`);

    void scheduleNewFestivalFollowCityJobs(insertedFestival.id).catch((err) =>
      console.warn("[notifications] scheduleNewFestivalFollowCityJobs", err),
    );

    return NextResponse.json({
      ok: true,
      festival_id: insertedFestival.id,
      redirect_to: `/admin/festivals/${insertedFestival.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return fail(pendingIdForLog, "unexpected_error", 500, message);
  }
}
