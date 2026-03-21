import { NextResponse } from "next/server";
import { rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
    const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
    if (!sourceUrl.trim()) {
      return NextResponse.json({ error: "source_url is required." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const timestamp = Date.now();
    const outcome = await rehostHeroImageIfRemote(supabaseAdmin, sourceUrl, (ext) => `festival-hero/manual/festival-${id}-${timestamp}.${ext}`);

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.error }, { status: 422 });
    }

    const publicUrl = outcome.publicUrl;
    const updatedAt = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await ctx.supabase
      .from("festivals")
      .update({
        hero_image: publicUrl,
        image_url: publicUrl,
        updated_at: updatedAt,
      })
      .eq("id", id)
      .select("id, hero_image, image_url")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: `Failed to update festival hero image: ${updateError.message}` }, { status: 500 });
    }

    if (!updatedRow) {
      return NextResponse.json({ error: "Festival not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      hero_image: updatedRow.hero_image,
      image_url: updatedRow.image_url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected hero image import error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
