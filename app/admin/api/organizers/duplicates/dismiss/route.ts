import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function canonicalize(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { a?: string; b?: string };
  const rawA = normalizeId(body.a);
  const rawB = normalizeId(body.b);
  if (!rawA || !rawB) return NextResponse.json({ error: "a and b are required" }, { status: 400 });
  if (rawA === rawB) return NextResponse.json({ error: "a and b must be different" }, { status: 400 });

  const [orgA, orgB] = canonicalize(rawA, rawB);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("organizer_duplicate_dismissals")
    .upsert(
      { organizer_a: orgA, organizer_b: orgB, dismissed_by: ctx.user.id },
      { onConflict: "organizer_a,organizer_b" },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.duplicate_dismissed",
      entity_type: "organizer",
      entity_id: orgA,
      route: "/admin/api/organizers/duplicates/dismiss",
      method: "POST",
      details: { organizer_a: orgA, organizer_b: orgB },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { a?: string; b?: string };
  const rawA = normalizeId(body.a);
  const rawB = normalizeId(body.b);
  if (!rawA || !rawB) return NextResponse.json({ error: "a and b are required" }, { status: 400 });

  const [orgA, orgB] = canonicalize(rawA, rawB);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await admin
    .from("organizer_duplicate_dismissals")
    .delete()
    .eq("organizer_a", orgA)
    .eq("organizer_b", orgB);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.duplicate_dismissal_restored",
      entity_type: "organizer",
      entity_id: orgA,
      route: "/admin/api/organizers/duplicates/dismiss",
      method: "DELETE",
      details: { organizer_a: orgA, organizer_b: orgB },
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
