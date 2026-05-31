import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { name, subject, body: tmplBody, sort_order } = (body ?? {}) as Record<string, unknown>;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === "string") patch.name = name.trim();
  if (typeof subject === "string") patch.subject = subject;
  if (typeof tmplBody === "string") patch.body = tmplBody;
  if (typeof sort_order === "number") patch.sort_order = sort_order;

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("outreach_email_templates")
    .update(patch)
    .eq("id", id)
    .select("id,name,subject,body,sort_order,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("outreach_email_templates").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
