import { NextResponse } from "next/server";
import { parseDefaultPlanReminderType } from "@/lib/plan/planReminderDefault";
import type { ReminderType } from "@/lib/plan/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationSettings = {
  notify_plan_reminders: boolean;
  notify_new_festivals_city: boolean;
  notify_new_festivals_category: boolean;
  notify_followed_organizers: boolean;
  notify_weekend_digest: boolean;
  push_enabled: boolean;
  only_saved: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  /** Persisted default for newly saved plan festivals (`user_notification_settings`). */
  default_plan_reminder_type: ReminderType;
};

type PartialNotificationSettings = Partial<NotificationSettings>;

const DEFAULT_SETTINGS: NotificationSettings = {
  notify_plan_reminders: true,
  notify_new_festivals_city: true,
  notify_new_festivals_category: false,
  notify_followed_organizers: true,
  notify_weekend_digest: false,
  push_enabled: true,
  only_saved: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  default_plan_reminder_type: "24h",
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
  if (typeof payload.push_enabled === "boolean") {
    normalized.push_enabled = payload.push_enabled;
  }
  if (typeof payload.only_saved === "boolean") {
    normalized.only_saved = payload.only_saved;
  }
  if (payload.quiet_hours_start === null || typeof payload.quiet_hours_start === "string") {
    normalized.quiet_hours_start = payload.quiet_hours_start;
  }
  if (payload.quiet_hours_end === null || typeof payload.quiet_hours_end === "string") {
    normalized.quiet_hours_end = payload.quiet_hours_end;
  }
  if (
    payload.default_plan_reminder_type === "none" ||
    payload.default_plan_reminder_type === "24h" ||
    payload.default_plan_reminder_type === "same_day_09"
  ) {
    normalized.default_plan_reminder_type = payload.default_plan_reminder_type;
  }

  return normalized;
}

function mergeSettingsRow(data: Record<string, unknown> | null): NotificationSettings {
  const base = { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  return {
    ...base,
    default_plan_reminder_type: parseDefaultPlanReminderType(
      (data as { default_plan_reminder_type?: unknown } | null)?.default_plan_reminder_type,
    ),
  };
}

const NOTIFICATION_SETTINGS_COLUMNS =
  "notify_plan_reminders,notify_new_festivals_city,notify_new_festivals_category,notify_followed_organizers,notify_weekend_digest,push_enabled,only_saved,quiet_hours_start,quiet_hours_end,default_plan_reminder_type" as const;

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
    settings: mergeSettingsRow(data as Record<string, unknown> | null),
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
      settings: mergeSettingsRow(updatedRow as Record<string, unknown>),
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
      settings: mergeSettingsRow(insertedRow as Record<string, unknown>),
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
        settings: mergeSettingsRow(retryRow as Record<string, unknown>),
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
