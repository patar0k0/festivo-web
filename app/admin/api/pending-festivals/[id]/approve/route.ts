import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { slugify } from "@/lib/utils";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  async function generateUniqueSlug(baseSlug: string) {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
      const { data } = await ctx.supabase
        .from("festivals")
        .select("id")
        .eq("slug", slug)
        .limit(1);

      if (!data || data.length === 0) return slug;

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  try {
    const { id } = await params;

    const { data: pending, error: pendingError } = await ctx.supabase
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

    const baseSlug = pending.slug ?? slugify(pending.title);
    const finalSlug = await generateUniqueSlug(baseSlug);

    let cityText = "unknown";

    if (pending.city_id) {
      const { data: city, error: cityError } = await ctx.supabase
        .from("cities")
        .select("slug,name_bg")
        .eq("id", pending.city_id)
        .limit(1)
        .maybeSingle();

      if (cityError) {
        return NextResponse.json({ error: `Approve failed during city lookup: ${cityError.message}` }, { status: 500 });
      }

      cityText = city?.slug ?? city?.name_bg ?? "unknown";
    }

    const { data: insertedFestival, error: insertError } = await ctx.supabase
      .from("festivals")
      .insert({
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
        is_free: pending.is_free,
        hero_image: pending.hero_image,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Approve failed: a conflicting festival already exists (for example, duplicate slug)." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: `Approve failed during festivals insert: ${insertError.message}` }, { status: 500 });
    }

    const { error: reviewError } = await ctx.supabase
      .from("pending_festivals")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      })
      .eq("id", id)
      .eq("status", "pending");

    if (reviewError) {
      if (insertedFestival?.id) {
        const { error: rollbackError } = await ctx.supabase.from("festivals").delete().eq("id", insertedFestival.id);
        const rollbackMessage = rollbackError ? ` Rollback failed: ${rollbackError.message}` : " Rollback succeeded.";
        return NextResponse.json({ error: `Approve failed while updating pending record.${rollbackMessage}` }, { status: 500 });
      }

      return NextResponse.json({ error: `Approve failed while updating pending record: ${reviewError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
