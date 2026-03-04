import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type UserNotificationRow = {
  id: string;
  user_id: string;
  title: string | null;
  body: string | null;
};

type DeviceTokenRow = {
  token: string;
};

async function sendPushNotification(tokens: string[], title: string, body: string, serverKey: string) {
  const response = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${serverKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: {
        title,
        body,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FCM request failed (${response.status}): ${errorText}`);
  }
}

export async function GET(request: Request) {
  const expectedSecret = process.env.JOBS_SECRET;
  const providedSecret = request.headers.get("x-job-secret");
  const isCron = request.headers.get("x-vercel-cron");

  if (!isCron && (!expectedSecret || providedSecret !== expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const fcmServerKey = process.env.FCM_SERVER_KEY;
  if (!fcmServerKey) {
    return NextResponse.json({ error: "FCM_SERVER_KEY is not set" }, { status: 500 });
  }

  const supabase = createSupabaseAdmin();

  const { data: notifications, error: notificationsError } = await supabase
    .from("user_notifications")
    .select("id,user_id,title,body")
    .not("sent_at", "is", null)
    .is("pushed_at", null)
    .limit(100);

  if (notificationsError) {
    return NextResponse.json({ error: notificationsError.message }, { status: 500 });
  }

  const rows = (notifications ?? []) as UserNotificationRow[];

  let pushed = 0;
  let skipped = 0;

  for (const notification of rows) {
    const { data: tokenRows, error: tokenError } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", notification.user_id);

    if (tokenError) {
      return NextResponse.json({ error: tokenError.message }, { status: 500 });
    }

    const tokens = ((tokenRows ?? []) as DeviceTokenRow[])
      .map((row) => row.token)
      .map((token) => token.trim())
      .filter((token) => Boolean(token));

    if (!tokens.length) {
      skipped += 1;
      continue;
    }

    try {
      await sendPushNotification(tokens, notification.title ?? "Notification", notification.body ?? "", fcmServerKey);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to send push notification",
          notification_id: notification.id,
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
