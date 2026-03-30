import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; mediaId: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: festivalId, mediaId } = await params;

  const { error } = await ctx.supabase.from("festival_media").delete().eq("id", mediaId).eq("festival_id", festivalId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
