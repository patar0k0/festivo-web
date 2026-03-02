import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Payload = {
  scheduleItemId?: string;
};

export async function POST(request: Request) {
  const user = await getOptionalUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = (await request.json()) as Payload;
  const scheduleItemId = body.scheduleItemId;

  if (!scheduleItemId) {
    return NextResponse.json({ error: "Missing scheduleItemId" }, { status: 400 });
  }

  const { data: existing } = await db
    .from("user_plan_items")
    .select("schedule_item_id")
    .eq("user_id", user.id)
    .eq("schedule_item_id", scheduleItemId)
    .maybeSingle();

  if (existing) {
    const { error: deleteError } = await db
      .from("user_plan_items")
      .delete()
      .eq("user_id", user.id)
      .eq("schedule_item_id", scheduleItemId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inPlan: false });
  }

  const { error: insertError } = await db.from("user_plan_items").insert({
    user_id: user.id,
    schedule_item_id: scheduleItemId,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inPlan: true });
}
