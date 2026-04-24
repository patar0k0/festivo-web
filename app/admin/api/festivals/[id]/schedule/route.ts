import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { parseProgramDraftUnknown, programDraftToPublishPayload, publishedRowsToProgramDraft, replaceFestivalScheduleFromProgramDraft } from "@/lib/festival/programDraft";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type ScheduleGetResponse = {
  ok: true;
  program_draft: ReturnType<typeof publishedRowsToProgramDraft>;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: festivalRow, error: festErr } = await ctx.supabase.from("festivals").select("id").eq("id", id).maybeSingle();
  if (festErr) {
    return NextResponse.json({ error: festErr.message }, { status: 500 });
  }
  if (!festivalRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createSupabaseAdmin();
  const { data: days, error: daysErr } = await admin
    .from("festival_days")
    .select("id, date, title")
    .eq("festival_id", id)
    .order("date", { ascending: true });

  if (daysErr) {
    return NextResponse.json({ error: daysErr.message }, { status: 500 });
  }

  const dayList = days ?? [];
  const dayIds = dayList.map((d) => d.id as string);
  let items: Array<{
    day_id: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    stage: string | null;
    description: string | null;
    sort_order: number | null;
  }> = [];

  if (dayIds.length > 0) {
    const { data: itemRows, error: itemsErr } = await admin
      .from("festival_schedule_items")
      .select("day_id, title, start_time, end_time, stage, description, sort_order")
      .in("day_id", dayIds)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });

    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
    items = (itemRows ?? []) as typeof items;
  }

  const program_draft = publishedRowsToProgramDraft(
    dayList.map((d) => ({ id: String(d.id), date: String(d.date), title: d.title })),
    items,
  );

  return NextResponse.json({ ok: true, program_draft } satisfies ScheduleGetResponse);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: festivalRow, error: festErr } = await ctx.supabase.from("festivals").select("id,title").eq("id", id).maybeSingle();
  if (festErr) {
    return NextResponse.json({ error: festErr.message }, { status: 500 });
  }
  if (!festivalRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { program_draft?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseProgramDraftUnknown(body.program_draft);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const draft = programDraftToPublishPayload(parsed.value);

  try {
    const admin = createSupabaseAdmin();
    await replaceFestivalScheduleFromProgramDraft(admin, id, draft);
    const { error: festivalDraftErr } = await admin.from("festivals").update({ program_draft: draft }).eq("id", id);
    if (festivalDraftErr) {
      throw new Error(`festival program_draft update failed: ${festivalDraftErr.message}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "schedule update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival.schedule_updated",
      entity_type: "festival",
      entity_id: id,
      route: "/admin/api/festivals/[id]/schedule",
      method: "PUT",
      details: {
        day_count: draft?.days.length ?? 0,
        item_count: draft ? draft.days.reduce((n, d) => n + d.items.length, 0) : 0,
        target_title: typeof festivalRow.title === "string" ? festivalRow.title : null,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] festival.schedule_updated failed", { message });
  }

  console.info("[program-save] saved", { festivalId: id, payload: draft ?? null });

  return NextResponse.json({ ok: true });
}
