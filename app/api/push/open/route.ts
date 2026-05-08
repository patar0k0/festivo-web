import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/authUser";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type PushOpenBody = {
  notification_id?: string;
  open_context?: "cold_start" | "background" | "foreground";
};

export async function POST(request: Request) {
  let body: PushOpenBody;
  try {
    body = (await request.json()) as PushOpenBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const notificationId = typeof body.notification_id === "string" ? body.notification_id.trim() : "";
  if (!notificationId) {
    return NextResponse.json({ ok: false, error: "notification_id is required" }, { status: 400 });
  }

  const user = await getOptionalUser().catch(() => null);
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const now = new Date().toISOString();
  const providerMeta =
    body.open_context && typeof body.open_context === "string" ? { open_context: body.open_context } : {};

  const { error } = await supabase
    .from("push_delivery_audit")
    .update({
      opened_at: now,
      provider_response: { ...providerMeta, opened_tracked_at: now },
    })
    .eq("user_id", user.id)
    .eq("notification_job_id", notificationId)
    .is("opened_at", null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
