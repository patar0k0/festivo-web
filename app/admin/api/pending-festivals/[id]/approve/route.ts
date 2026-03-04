import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const { data: insertedFestival, error: insertError } = await ctx.supabase
      .from("festivals")
      .insert({
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
        is_free: pending.is_free,
        hero_image: pending.hero_image,
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
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
