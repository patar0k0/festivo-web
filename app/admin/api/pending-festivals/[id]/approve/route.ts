import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { resolveOrCreateCity } from "@/lib/admin/resolveOrCreateCity";
import { slugify } from "@/lib/utils";

type CityRow = {
  id: number;
  slug: string;
  name_bg: string;
};

type ApprovePayload = {
  city?: string | null;
};

type PendingFestivalRow = {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  city_id: number | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string | null;
  end_date: string | null;
  organizer_name: string | null;
  source_url: string | null;
  is_free: boolean | null;
  hero_image: string | null;
  status: "pending" | "approved" | "rejected";
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

function normalizeCityInput(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function fail(pendingId: string, reason: string, status: number, error: string) {
  console.error(`[pending-approve] pending_id=${pendingId} fail reason=${reason}`);
  return NextResponse.json<ApiErrorResponse>({ ok: false, error }, { status });
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

    const { data: pending, error: pendingError } = await adminCtx.supabase
      .from("pending_festivals")
      .select("id,title,slug,description,city_id,location_name,latitude,longitude,start_date,end_date,organizer_name,source_url,is_free,hero_image,status")
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

    const cityInputRaw = typeof body?.city === "string" ? body.city : "";
    const cityInput = normalizeCityInput(cityInputRaw);

    let cityText = "unknown";
    let cityId: number | null = pending.city_id ?? null;

    if (cityInput) {
      if (/^\d+$/.test(cityInput)) {
        const cityById = await findCityById(Number(cityInput));
        if (!cityById) {
          return fail(id, "city_could_not_be_resolved", 400, "city could not be resolved");
        }

        cityId = cityById.id;
        cityText = cityById.slug || cityById.name_bg || cityText;
      } else {
        const resolvedCity = await resolveOrCreateCity(cityInput);
        if (!resolvedCity.city) {
          return fail(id, "city_could_not_be_resolved", 400, "city could not be resolved");
        }

        cityId = resolvedCity.city.id;
        cityText = resolvedCity.city.slug;
      }
    } else if (pending.city_id != null) {
      const cityByPendingId = await findCityById(pending.city_id);
      if (!cityByPendingId) {
        return fail(id, "city_could_not_be_resolved", 400, "city could not be resolved");
      }

      cityId = cityByPendingId.id;
      cityText = cityByPendingId.slug || cityByPendingId.name_bg || cityText;
    }

    console.info(`[pending-approve] pending_id=${id} city resolved city_id=${cityId ?? "null"}`);

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

    const normalizedDescription = (pending.description ?? "").trim();
    const normalizedImageUrl = (pending.hero_image ?? "").trim();
    const normalizedAddress = (pending.location_name ?? "").trim();

    const insertPayload = {
      title: pending.title,
      slug: finalSlug,
      description: normalizedDescription,
      city: cityText,
      city_id: cityId,
      region: "",
      address: normalizedAddress || null,
      start_date: pending.start_date,
      end_date: pending.end_date,
      category: "festival",
      source_url: pending.source_url,
      source_type: "pending_approval",
      is_free: pending.is_free ?? true,
      image_url: normalizedImageUrl,
      lat: pending.latitude,
      lng: pending.longitude,
      status: "verified",
      is_verified: true,
      updated_at: new Date().toISOString(),
    };

    console.info(`[pending-approve] pending_id=${id} festivals payload keys=${Object.keys(insertPayload).join(",")}`);

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

    console.info(`[pending-approve] pending_id=${id} festivals insert ok festival_id=${insertedFestival.id}`);

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
