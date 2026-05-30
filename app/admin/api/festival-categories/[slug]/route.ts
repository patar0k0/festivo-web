import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { slug } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.label_bg === "string" && body.label_bg.trim()) {
    patch.label_bg = body.label_bg.trim();
  }
  if (typeof body.sort_order === "number") {
    patch.sort_order = body.sort_order;
  }
  if (typeof body.is_active === "boolean") {
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Няма валидни полета за обновяване" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("festival_categories")
    .update(patch)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Не е намерена" }, { status: 404 });
  }

  return NextResponse.json({ category: data });
}
