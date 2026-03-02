import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ReminderType } from "@/lib/plan/server";

type Payload = {
  festivalId?: string;
  reminderType?: ReminderType;
};

const allowed = new Set<ReminderType>(["none", "24h", "same_day_09"]);

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
  const festivalId = body.festivalId;
  const reminderType = body.reminderType;

  if (!festivalId || !reminderType || !allowed.has(reminderType)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (reminderType === "none") {
    const { error } = await db
      .from("user_plan_reminders")
      .delete()
      .eq("user_id", user.id)
      .eq("festival_id", festivalId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, reminderType: "none" });
  }

  const { error } = await db
    .from("user_plan_reminders")
    .upsert(
      {
        user_id: user.id,
        festival_id: festivalId,
        reminder_type: reminderType,
      },
      { onConflict: "user_id,festival_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reminderType });
}
