import { NextResponse } from "next/server";
import { isAuthorizedJobRequest } from "@/lib/jobs/auth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildDeepLink } from "@/lib/notifications/scheduler";
import { sendPushToUser } from "@/lib/push/sendPush";
import type { NotificationPayloadV1 } from "@/lib/notifications/types";

type UserNotificationRow = {
  id: string;
  user_id: string;
  festival_id: string;
  type: string;
  title: string | null;
  body: string | null;
};

export async function GET(request: Request) {
  if (!isAuthorizedJobRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();

  const { data: notifications, error: notificationsError } = await supabase
    .from("user_notifications")
    .select("id,user_id,festival_id,type,title,body")
    .not("sent_at", "is", null)
    .is("pushed_at", null)
    .limit(100);

  if (notificationsError) {
    return NextResponse.json({ error: notificationsError.message }, { status: 500 });
  }

  const rows = (notifications ?? []) as UserNotificationRow[];

  let pushed = 0;
  let skipped = 0;

  const festivalIds = [...new Set(rows.map((r) => r.festival_id))];
  const { data: festivalRows, error: festivalsError } = festivalIds.length
    ? await supabase.from("festivals").select("id,slug").in("id", festivalIds)
    : ({ data: [] as Array<{ id: string; slug: string | null }>, error: null } as const);

  if (festivalsError) {
    return NextResponse.json({ error: festivalsError.message }, { status: 500 });
  }

  const slugByFestivalId = new Map<string, string>();
  for (const f of festivalRows ?? []) {
    if (f.slug) slugByFestivalId.set(f.id, f.slug);
  }

  for (const notification of rows) {
    const festivalSlug = slugByFestivalId.get(notification.festival_id);
    if (!festivalSlug) {
      skipped += 1;
      continue;
    }

    const title = notification.title ?? "Notification";
    const body = notification.body ?? "";

    const payload: NotificationPayloadV1 = {
      type: notification.type,
      festival_id: notification.festival_id,
      slug: festivalSlug,
      deep_link: buildDeepLink(festivalSlug),
      title,
      body,
      source: "push",
      notification_id: notification.id,
    };

    let sendResult;
    try {
      sendResult = await sendPushToUser(supabase, notification.user_id, payload, { pushEnabled: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[push][failed]", { notification_id: notification.id, message });
      return NextResponse.json(
        {
          error: "Unexpected push error",
          notification_id: notification.id,
        },
        { status: 500 },
      );
    }

    if (sendResult.error) {
      return NextResponse.json(
        {
          error: sendResult.error,
          notification_id: notification.id,
        },
        { status: 500 },
      );
    }

    if (sendResult.skipped) {
      skipped += 1;
      continue;
    }

    if (!sendResult.ok) {
      return NextResponse.json(
        {
          error: "Failed to send push notification",
          notification_id: notification.id,
          raw: sendResult.raw,
        },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("user_notifications")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", notification.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    pushed += 1;
  }

  return NextResponse.json({ processed: rows.length, pushed, skipped });
}
