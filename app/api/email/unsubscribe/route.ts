import { NextResponse } from "next/server";
import { applyUnsubscribeByToken, type UnsubscribeAction } from "@/lib/email/emailPreferences";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  token?: string;
  action?: string;
};

function isAction(v: string): v is UnsubscribeAction {
  return v === "reminder_emails_off" || v === "all_optional_off";
}

export async function POST(request: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const actionRaw = typeof body.action === "string" ? body.action.trim() : "";

  if (!token || !actionRaw || !isAction(actionRaw)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const result = await applyUnsubscribeByToken(supabase, token, actionRaw);

  if (!result.ok) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    action: actionRaw,
  });
}
