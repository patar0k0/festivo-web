import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("outreach_email_templates")
    .select("id,name,subject,body,sort_order,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { name, subject, body: tmplBody, sort_order } = (body ?? {}) as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim())
    return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("outreach_email_templates")
    .insert({ name: name.trim(), subject: String(subject ?? ""), body: String(tmplBody ?? ""), sort_order: Number(sort_order ?? 0) })
    .select("id,name,subject,body,sort_order,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
