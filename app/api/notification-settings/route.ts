import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationSettings = {
  notify_plan_reminders: boolean;
  notify_new_festivals_city: boolean;
  notify_new_festivals_category: boolean;
  notify_followed_organizers: boolean;
  notify_weekend_digest: boolean;
};

type PartialNotificationSettings = Partial<NotificationSettings>;

const DEFAULT_SETTINGS: NotificationSettings = {
  notify_plan_reminders: true,
  notify_new_festivals_city: true,
  notify_new_festivals_category: false,
  notify_followed_organizers: true,
  notify_weekend_digest: false,
};

function normalizePayload(payload: PartialNotificationSettings): PartialNotificationSettings {
  const normalized: PartialNotificationSettings = {};

  if (typeof payload.notify_plan_reminders === "boolean") {
    normalized.notify_plan_reminders = payload.notify_plan_reminders;
  }
  if (typeof payload.notify_new_festivals_city === "boolean") {
    normalized.notify_new_festivals_city = payload.notify_new_festivals_city;
  }
  if (typeof payload.notify_new_festivals_category === "boolean") {
    normalized.notify_new_festivals_category = payload.notify_new_festivals_category;
  }
  if (typeof payload.notify_followed_organizers === "boolean") {
    normalized.notify_followed_organizers = payload.notify_followed_organizers;
  }
  if (typeof payload.notify_weekend_digest === "boolean") {
    normalized.notify_weekend_digest = payload.notify_weekend_digest;
  }

  return normalized;
}

const NOTIFICATION_SETTINGS_COLUMNS =
  "notify_plan_reminders,notify_new_festivals_city,notify_new_festivals_category,notify_followed_organizers,notify_weekend_digest" as const;

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { supabase, user, error };
}

export async function GET() {
  const { supabase, user, error: authError } = await requireUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select(NOTIFICATION_SETTINGS_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: {
      ...DEFAULT_SETTINGS,
      ...(data ?? {}),
    },
  });
}

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await requireUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as PartialNotificationSettings;
  const updates = normalizePayload(body);

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
  }

  // Prefer update-then-insert over upsert: INSERT...ON CONFLICT DO UPDATE under RLS
  // can fail in some Postgres setups while plain update/insert succeed.

  const { data: updatedRow, error: updateError } = await supabase
    .from("user_notification_settings")
    .update(updates)
    .eq("user_id", user.id)
    .select(NOTIFICATION_SETTINGS_COLUMNS)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (updatedRow) {
    return NextResponse.json({
      settings: { ...DEFAULT_SETTINGS, ...updatedRow },
    });
  }

  const insertPayload = { user_id: user.id, ...updates };
  const { data: insertedRow, error: insertError } = await supabase
    .from("user_notification_settings")
    .insert(insertPayload)
    .select(NOTIFICATION_SETTINGS_COLUMNS)
    .maybeSingle();

  if (!insertError && insertedRow) {
    return NextResponse.json({
      settings: { ...DEFAULT_SETTINGS, ...insertedRow },
    });
  }

  const isUniqueViolation =
    insertError?.code === "23505" ||
    (typeof insertError?.message === "string" && insertError.message.toLowerCase().includes("duplicate"));

  if (isUniqueViolation) {
    const { data: retryRow, error: retryError } = await supabase
      .from("user_notification_settings")
      .update(updates)
      .eq("user_id", user.id)
      .select(NOTIFICATION_SETTINGS_COLUMNS)
      .single();

    if (!retryError && retryRow) {
      return NextResponse.json({
        settings: { ...DEFAULT_SETTINGS, ...retryRow },
      });
    }
    return NextResponse.json(
      { error: retryError?.message ?? insertError?.message ?? "Conflict saving settings" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { error: insertError?.message ?? "Failed to save notification settings" },
    { status: 500 },
  );
}
