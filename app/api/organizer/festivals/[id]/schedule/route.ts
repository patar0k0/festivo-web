import { NextResponse } from "next/server";
import { getPortalSessionUser, getPortalAdminClient } from "@/lib/organizer/portal";
import { assertOrganizerCanEditPublishedFestival } from "@/lib/organizer/festivalSelfEdit";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  parseProgramDraftUnknown,
  programDraftToPublishPayload,
  publishedRowsToProgramDraft,
  replaceFestivalScheduleFromProgramDraft,
} from "@/lib/festival/programDraft";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

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

  return NextResponse.json({ ok: true, program_draft });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { id } = await params;
  const gate = await assertOrganizerCanEditPublishedFestival(admin, session.user.id, id);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json().catch(() => null)) as { program_draft?: unknown } | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Невалидно тяло на заявката." }, { status: 400 });
  }

  const parsed = parseProgramDraftUnknown(body.program_draft);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const draft = programDraftToPublishPayload(parsed.value);

  try {
    await replaceFestivalScheduleFromProgramDraft(admin, id, draft);
    const updatedAt = new Date().toISOString();
    const { error: festivalDraftErr } = await admin
      .from("festivals")
      .update({ program_draft: draft, last_edited_by_organizer_at: updatedAt })
      .eq("id", id);
    if (festivalDraftErr) {
      throw new Error(`festival program_draft update failed: ${festivalDraftErr.message}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Грешка при обновяване на програмата.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: session.user.id,
      action: "festival.organizer_schedule_updated",
      entity_type: "festival",
      entity_id: id,
      route: "/api/organizer/festivals/[id]/schedule",
      method: "PUT",
      details: {
        organizer_id: gate.organizerId,
        day_count: draft?.days.length ?? 0,
        item_count: draft ? draft.days.reduce((n, d) => n + d.items.length, 0) : 0,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[organizer/audit] festival.organizer_schedule_updated failed", { message });
  }

  const savedItemsCount = draft ? draft.days.reduce((n, d) => n + d.items.length, 0) : 0;
  return NextResponse.json({ ok: true, savedItemsCount });
}
