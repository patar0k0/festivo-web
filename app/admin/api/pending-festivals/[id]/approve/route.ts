import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeSettlementInput, resolveCityReference } from "@/lib/admin/resolveCityReference";
import { slugify } from "@/lib/utils";
import { canonicalFromPending } from "@/lib/festival/canonical";

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
  city_id: number | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  organizer_name: string | null;
  source_url: string | null;
  website_url: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  region?: string | null;
  category?: string | null;
  is_free: boolean | null;
  hero_image: string | null;
  tags: unknown;
  status: "pending" | "approved" | "rejected";
};

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
      .select("id,title,slug,description,city_id,location_name,address,latitude,longitude,start_date,end_date,organizer_name,source_url,website_url,is_free,hero_image,tags,status")
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

    console.info(`[pending-approve] pending_id=${id} fetched pending row`);

    const canonicalPending = canonicalFromPending(pending);

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

    const resolvedCity = await resolveCityReference(adminCtx.supabase, cityInput);
    if (!resolvedCity) {
      return fail(id, "city_not_resolved", 400, `City could not be resolved: "${cityInput}".`);
    }

    const cityById = await findCityById(resolvedCity.id);
    if (!cityById?.slug) {
      return fail(id, "resolved_city_not_found", 400, "Resolved city is missing canonical data.");
    }

    const cityId = cityById.id;
    const cityText = cityById.slug;

    console.info(`[pending-approve] pending_id=${id} city input="${cityInput}" resolved_city_id=${cityId}`);

    const pendingTags = Array.isArray(pending.tags)
      ? pending.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean)
      : [];
    const finalTags = overrideTags ?? pendingTags;
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

    const normalizedAddress = normalizeSettlementInput(canonicalPending.address ?? "");

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

    const mappedSourceType = mapFestivalSourceType(rawSourceType);

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
        website_url: pending.website_url,
        is_free: pending.is_free,
        hero_image: pending.hero_image,
        tags: pending.tags,
      })}`,
    );

    const insertPayload = {
      title: canonicalPending.title,
      slug: finalSlug,
      description: canonicalPending.description,
      city: cityText || null,
      city_id: cityId,
      region: canonicalPending.region,
      location_name: canonicalPending.venue_name,
      address: normalizedAddress || null,
      start_date: canonicalPending.start_date,
      end_date: canonicalPending.end_date,
      organizer_name: canonicalPending.organizer_name,
      category: canonicalPending.category ?? "festival",
      source_url: canonicalPending.source_url,
      website_url: canonicalPending.website_url,
      ticket_url: canonicalPending.ticket_url,
      price_range: canonicalPending.price_range,
      source_type: mappedSourceType,
      is_free: pending.is_free ?? true,
      hero_image: canonicalPending.hero_image,
      image_url: canonicalPending.hero_image,
      tags: finalTags,
      lat: canonicalPending.latitude,
      lng: canonicalPending.longitude,
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
