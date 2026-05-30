import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdmin();

  const [catResult, countResult] = await Promise.all([
    admin
      .from("festival_categories")
      .select("slug,label_bg,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("label_bg", { ascending: true }),
    admin
      .from("festivals")
      .select("category")
      .not("category", "is", null)
      .neq("status", "archived"),
  ]);

  if (catResult.error) {
    return NextResponse.json({ error: catResult.error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of countResult.data ?? []) {
    const c = typeof row.category === "string" ? row.category.trim() : "";
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }

  const categories = (catResult.data ?? []).map((cat) => ({
    ...cat,
    festival_count: counts[cat.slug] ?? 0,
  }));

  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const label_bg = typeof body?.label_bg === "string" ? body.label_bg.trim() : "";
  if (!label_bg) {
    return NextResponse.json({ error: "label_bg е задължително" }, { status: 400 });
  }

  const sort_order = typeof body?.sort_order === "number" ? body.sort_order : 99;
  const slug = label_bg.toLocaleLowerCase("bg-BG").replace(/\s+/g, " ").trim();

  if (!slug) {
    return NextResponse.json({ error: "Невалиден лейбъл" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("festival_categories")
    .insert({ slug, label_bg, sort_order })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Категория с този slug вече съществува" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
}
