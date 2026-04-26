import { NextResponse } from "next/server";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  scheduleItemId?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Payload;
  const scheduleItemId = body.scheduleItemId;

  if (!scheduleItemId) {
    return NextResponse.json({ error: "Missing scheduleItemId" }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase
    .from("user_plan_items")
    .select("schedule_item_id")
    .eq("user_id", user.id)
    .eq("schedule_item_id", scheduleItemId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("user_plan_items")
      .delete()
      .eq("user_id", user.id)
      .eq("schedule_item_id", scheduleItemId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inPlan: false });
  }

  const { data: scheduleMeta, error: scheduleMetaError } = await supabase
    .from("festival_schedule_items")
    .select("festival_days!inner(festival_id)")
    .eq("id", scheduleItemId)
    .maybeSingle<{ festival_days: { festival_id: string } | { festival_id: string }[] }>();

  if (scheduleMetaError) {
    return NextResponse.json({ error: scheduleMetaError.message }, { status: 500 });
  }

  const festivalJoin = Array.isArray(scheduleMeta?.festival_days) ? scheduleMeta?.festival_days[0] : scheduleMeta?.festival_days;
  const festivalId = festivalJoin?.festival_id;

  if (!festivalId) {
    return NextResponse.json({ error: "Schedule item not found" }, { status: 404 });
  }

  const { data: festival, error: festivalError } = await supabase
    .from("festivals")
    .select("start_date,end_date")
    .eq("id", festivalId)
    .maybeSingle<{ start_date: string | null; end_date: string | null }>();

  if (festivalError) {
    return NextResponse.json({ error: festivalError.message }, { status: 500 });
  }

  if (!festival) {
    return NextResponse.json({ error: "Festival not found" }, { status: 404 });
  }

  if (isFestivalPast(festival)) {
    return NextResponse.json({ error: "Cannot add past festival to plan" }, { status: 400 });
  }

  const { error: insertError } = await supabase.from("user_plan_items").insert({
    user_id: user.id,
    schedule_item_id: scheduleItemId,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inPlan: true });
}
