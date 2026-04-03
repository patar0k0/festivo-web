import { NextResponse } from "next/server";
import { getOrCreateUserEmailPreferences } from "@/lib/email/emailPreferences";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EmailPrefsResponse = {
  reminder_emails_enabled: boolean;
  unsubscribed_all_optional: boolean;
};

type Body = {
  reminder_emails_enabled?: boolean;
};

const SELECT = "reminder_emails_enabled,unsubscribed_all_optional" as const;

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

  const row = await getOrCreateUserEmailPreferences(supabase, user.id);
  const payload: EmailPrefsResponse = {
    reminder_emails_enabled: row.reminder_emails_enabled,
    unsubscribed_all_optional: row.unsubscribed_all_optional,
  };
  return NextResponse.json({ preferences: payload });
}

export async function POST(request: Request) {
  const { supabase, user, error: authError } = await requireUser();
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
