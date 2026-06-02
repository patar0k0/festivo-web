// app/admin/api/research-smart/check-duplicates/route.ts
//
// Admin-gated duplicate lookup for the Smart Research panel. Given a researched
// title (+ optional start_date), returns existing festivals / pending rows with
// similar titles so the admin can avoid creating a duplicate before sending the
// result into moderation.
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { findDuplicateFestivals } from "@/lib/admin/research/findDuplicateFestivals";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { title?: unknown; start_date?: unknown };
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const startDate = typeof body?.start_date === "string" ? body.start_date.trim() : null;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const matches = await findDuplicateFestivals({ title, startDate });
    return NextResponse.json({ ok: true, matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
