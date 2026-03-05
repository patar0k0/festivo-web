import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { slugify } from "@/lib/utils";

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

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  try {
    const { id } = await params;

    const { data: pending, error: pendingError } = await adminCtx.supabase
      .from("pending_festivals")
      .select("id,title,slug,description,city_id,location_name,latitude,longitude,start_date,end_date,organizer_name,source_url,is_free,hero_image,status")
      .eq("id", id)
      .maybeSingle();

    if (pendingError) {
      return NextResponse.json({ error: pendingError.message }, { status: 500 });
    }

    if (!pending) {
      return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
    }

    if (pending.status !== "pending") {
      return NextResponse.json({ error: `Festival already reviewed with status '${pending.status}'.` }, { status: 409 });
    }

    let cityText = "unknown";

    if (pending.city_id != null) {
      const { data: city, error: cityError } = await adminCtx.supabase
        .from("cities")
        .select("slug,name_bg")
        .eq("id", pending.city_id)
        .maybeSingle();

      if (cityError) {
        return NextResponse.json({ error: `Approve failed during city lookup: ${cityError.message}` }, { status: 500 });
      }

      if (city?.slug) {
        cityText = city.slug;
      } else if (city?.name_bg) {
        cityText = city.name_bg;
        console.warn(`[pending-approve] city ${pending.city_id} missing slug; using name_bg fallback.`);
      }
    }

    if (pending.source_url) {
      const { data: existingBySource, error: existingBySourceError } = await adminCtx.supabase
        .from("festivals")
        .select("id")
        .eq("source_url", pending.source_url)
        .limit(1);

      if (existingBySourceError) {
        return NextResponse.json({ error: `Approve failed during source_url check: ${existingBySourceError.message}` }, { status: 500 });
      }

      if (existingBySource && existingBySource.length > 0) {
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
      return NextResponse.json(
        { error: "Unable to generate a unique festival slug after 50 attempts." },
        { status: 409 }
      );
    }

    const insertPayload = {
      title: pending.title,
      slug: finalSlug,
      description: pending.description,
      city: cityText,
      city_id: pending.city_id,
      location_name: pending.location_name,
      latitude: pending.latitude,
      longitude: pending.longitude,
      start_date: pending.start_date,
      end_date: pending.end_date,
      organizer_name: pending.organizer_name,
      source_url: pending.source_url,
      is_free: pending.is_free ?? true,
      hero_image: pending.hero_image,
      category: "festival",
      status: "verified",
      is_verified: true,
    };

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

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Conflicting festival already exists (duplicate slug/source_url)." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: insertError.message }, { status: 500 });
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
      if (insertedFestival?.id) {
        await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      }
      return NextResponse.json({ error: `Approve failed while updating pending record: ${reviewError.message}` }, { status: 500 });
    }

    if (!reviewRow) {
      if (insertedFestival?.id) {
        await adminCtx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
      }

      return NextResponse.json({ error: "Pending record not pending anymore." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, festival_id: insertedFestival?.id, slug: finalSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
