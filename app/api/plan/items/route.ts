import { NextResponse } from "next/server";
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

  const { error: insertError } = await supabase.from("user_plan_items").insert({
    user_id: user.id,
    schedule_item_id: scheduleItemId,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inPlan: true });
}
