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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      console.error(`[pending-approve] pending_id=${id} fail reason=pending_lookup_error details="${pendingError.message}"`);
      return NextResponse.json({ error: pendingError.message }, { status: 500 });
    }

    if (!pending) {
      console.error(`[pending-approve] pending_id=${id} fail reason=not_found`);
      return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
    }

    if (pending.status !== "pending") {
      console.error(`[pending-approve] pending_id=${id} fail reason=not_pending current_status=${pending.status}`);
      return NextResponse.json({ error: `Festival already reviewed with status '${pending.status}'.` }, { status: 409 });
    }

    const cityInputRaw = typeof body?.city === "string" ? body.city : "";
    const cityInput = normalizeCityInput(cityInputRaw);

    let cityText = "unknown";
    let cityId: number | null = pending.city_id ?? null;

    if (cityInput) {
      if (/^\d+$/.test(cityInput)) {
        const cityById = await findCityById(Number(cityInput));
        if (!cityById) {
          console.error(`[pending-approve] pending_id=${id} fail reason=city_id_not_found city_input=${cityInput}`);
          return NextResponse.json({ error: "Approve failed during city lookup: city id not found." }, { status: 500 });
        }

        cityId = cityById.id;
        cityText = cityById.slug || cityById.name_bg || cityText;
        console.info(`[pending-approve] pending_id=${id} city_resolve_ok input="${cityInput}" resolved="${cityById.slug}" created=false`);
      } else {
        const resolvedCity = await resolveOrCreateCity(cityInput);
        if (!resolvedCity.city) {
          console.error(`[pending-approve] pending_id=${id} fail reason=city_not_found city_input="${cityInput}"`);
          return NextResponse.json({ error: "Approve failed during city lookup: city not found." }, { status: 500 });
        }

        cityId = resolvedCity.city.id;
        cityText = resolvedCity.city.slug;
        console.info(
          `[pending-approve] pending_id=${id} city_resolve_ok input="${cityInputRaw}" display_name="${resolvedCity.displayName}" slug="${resolvedCity.slug}" resolved_city_id=${resolvedCity.city.id} created=${resolvedCity.created}`
        );
      }
    } else if (pending.city_id != null) {
      const cityByPendingId = await findCityById(pending.city_id);
      if (!cityByPendingId) {
        console.error(`[pending-approve] pending_id=${id} fail reason=pending_city_id_not_found city_id=${pending.city_id}`);
        return NextResponse.json({ error: "Approve failed during city lookup: pending city id not found." }, { status: 500 });
      }

      cityId = cityByPendingId.id;
      cityText = cityByPendingId.slug || cityByPendingId.name_bg || cityText;
    }

    if (pending.source_url) {
      const { data: existingBySource, error: existingBySourceError } = await adminCtx.supabase
        .from("festivals")
        .select("id")
        .eq("source_url", pending.source_url)
        .limit(1);

      if (existingBySourceError) {
        console.error(`[pending-approve] pending_id=${id} fail reason=source_url_check_error details="${existingBySourceError.message}"`);
        return NextResponse.json({ error: `Approve failed during source_url check: ${existingBySourceError.message}` }, { status: 500 });
      }

      if (existingBySource && existingBySource.length > 0) {
        console.error(`[pending-approve] pending_id=${id} fail reason=source_url_conflict`);
        return NextResponse.json({ error: "Festival already exists for this source URL." }, { status: 409 });
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
      console.error(`[pending-approve] pending_id=${id} fail reason=slug_conflict base_slug=${baseSlug}`);
      return NextResponse.json(
        { error: "Unable to generate a unique festival slug after 50 attempts." },
        { status: 409 }
      );
    }

    if (!pending.start_date) {
      console.error(`[pending-approve] pending_id=${id} fail reason=missing_start_date`);
      return NextResponse.json({ error: "Start date is required before approval." }, { status: 400 });
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
      category_slug: "festival",
      source_url: pending.source_url,
      source_type: "pending_approval",
      is_free: pending.is_free ?? true,
      image_url: normalizedImageUrl,
      hero_image: pending.hero_image,
      lat: pending.latitude,
      lng: pending.longitude,
      status: "verified",
      is_verified: true,
      updated_at: new Date().toISOString(),
    };

    console.info(`[pending-approve] pending_id=${id} validate ok slug=${finalSlug}`);

    let { data: insertedFestival, error: insertError } = await adminCtx.supabase
      .from("festivals")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (insertError?.code === "42703" && insertError.message.includes("is_verified")) {
      const payloadWithoutIsVerified = { ...insertPayload, status: "verified" };
      delete (payloadWithoutIsVerified as { is_verified?: boolean }).is_verified;

      const retryResult = await adminCtx.supabase
        .from("festivals")
        .insert(payloadWithoutIsVerified)
        .select("id")
        .maybeSingle();

      insertedFestival = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError?.code === "42703" && insertError.message.includes("hero_image")) {
      const payloadWithoutHeroImage = { ...insertPayload };
      delete (payloadWithoutHeroImage as { hero_image?: string | null }).hero_image;

      const retryResult = await adminCtx.supabase
        .from("festivals")
        .insert(payloadWithoutHeroImage)
        .select("id")
        .maybeSingle();

      insertedFestival = retryResult.data;
      insertError = retryResult.error;
    }

    if (insertError) {
      if (insertError.code === "23505") {
        console.error(`[pending-approve] pending_id=${id} fail reason=insert_conflict`);
        return NextResponse.json(
          { error: "Conflicting festival already exists (duplicate slug/source_url)." },
          { status: 409 }
        );
      }

      console.error(`[pending-approve] pending_id=${id} fail reason=insert_error details="${insertError.message}"`);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.info(`[pending-approve] pending_id=${id} publish festivals upsert ok festival_id=${insertedFestival?.id ?? "unknown"}`);

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
      if (insertedFestival?.id) {
        await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      }
      console.error(`[pending-approve] pending_id=${id} fail reason=pending_status_update_error details="${reviewError.message}"`);
      return NextResponse.json({ error: `Approve failed while updating pending record: ${reviewError.message}` }, { status: 500 });
    }

    if (!reviewRow) {
      if (insertedFestival?.id) {
        await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      }

      console.error(`[pending-approve] pending_id=${id} fail reason=pending_status_not_updated`);
      return NextResponse.json({ error: "Pending record not pending anymore." }, { status: 409 });
    }

    console.info(`[pending-approve] pending_id=${id} pending status updated=approved`);

    return NextResponse.json({ ok: true, festival_id: insertedFestival?.id, slug: finalSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    console.error(`[pending-approve] pending_id=${pendingIdForLog} fail reason=unexpected_error details="${message}"`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
