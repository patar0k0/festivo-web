import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";
import { getOrCreateUserEmailPreferences } from "@/lib/email/emailPreferences";

type EmailPrefsResponse = {
  reminder_emails_enabled: boolean;
  unsubscribed_all_optional: boolean;
};

type Body = {
  reminder_emails_enabled?: boolean;
};

const SELECT = "reminder_emails_enabled,unsubscribed_all_optional" as const;

export async function GET(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[email/preferences] GET auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  const row = await getOrCreateUserEmailPreferences(supabase, user.id);
  const payload: EmailPrefsResponse = {
    reminder_emails_enabled: row.reminder_emails_enabled,
    unsubscribed_all_optional: row.unsubscribed_all_optional,
  };
  return NextResponse.json({ preferences: payload });
}

export async function POST(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[email/preferences] POST auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.reminder_emails_enabled !== "boolean") {
    return NextResponse.json({ error: "reminder_emails_enabled (boolean) required" }, { status: 400 });
  }

  await getOrCreateUserEmailPreferences(supabase, user.id);
  const nowIso = new Date().toISOString();
  const patch: {
    reminder_emails_enabled: boolean;
    updated_at: string;
    unsubscribed_all_optional?: boolean;
  } = {
    reminder_emails_enabled: body.reminder_emails_enabled,
    updated_at: nowIso,
  };
  if (body.reminder_emails_enabled === true) {
    patch.unsubscribed_all_optional = false;
  }

  const { data: updated, error: upErr } = await supabase
    .from("user_email_preferences")
    .update(patch)
    .eq("user_id", user.id)
    .select(SELECT)
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const preferences: EmailPrefsResponse = {
    reminder_emails_enabled: updated?.reminder_emails_enabled ?? body.reminder_emails_enabled,
    unsubscribed_all_optional: updated?.unsubscribed_all_optional ?? false,
  };

  return NextResponse.json({ preferences });
}
