import { NextResponse, type NextRequest } from "next/server";

import { applyResendEmailEventToEmailJob } from "@/lib/email/applyResendEmailEventToEmailJob";
import { normalizeEmailWebhookEvent } from "@/lib/email/normalizeEmailWebhookEvent";
import { verifyResendWebhook } from "@/lib/email/webhook/verifyResendWebhook";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * Resend → Svix-signed webhook. Raw body required for signature verification.
 * @see https://resend.com/docs/webhooks/verify-webhooks-requests
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[email webhook] RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  let payload: ReturnType<typeof verifyResendWebhook>;
  try {
    payload = verifyResendWebhook(rawBody, svixId, svixTimestamp, svixSignature, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "verify_failed";
    console.warn("[email webhook] verify failed", { message: msg });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const deliveryId = svixId?.trim() || null;
  if (!deliveryId) {
    console.warn("[email webhook] missing svix-id header after verify");
    return NextResponse.json({ error: "missing_delivery_id" }, { status: 400 });
  }

  const normalized = normalizeEmailWebhookEvent(payload, deliveryId);

  let supabase: ReturnType<typeof createSupabaseAdmin>;
  try {
    supabase = createSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "no_supabase";
    console.error("[email webhook] admin client missing", { message });
    return NextResponse.json({ error: "server_misconfigured" }, { status: 503 });
  }

  let emailJobId: string | null = null;
  if (normalized.provider_message_id) {
    const { data: jobs, error: jobErr } = await supabase
      .from("email_jobs")
      .select("id")
      .eq("provider", "resend")
      .eq("provider_message_id", normalized.provider_message_id)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1);

    if (jobErr) {
      console.error("[email webhook] email_job lookup failed", { message: jobErr.message });
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
    emailJobId = jobs?.[0]?.id ?? null;
  }

  const insertRow = {
    email_job_id: emailJobId,
    provider: normalized.provider,
    provider_message_id: normalized.provider_message_id,
    event_type: normalized.event_type,
    event_payload: normalized.event_payload,
    occurred_at: normalized.occurred_at,
    webhook_delivery_id: normalized.webhook_delivery_id,
  };

  const { error: insErr } = await supabase.from("email_events").insert(insertRow);

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }
    console.error("[email webhook] insert failed", { message: insErr.message, code: insErr.code });
    return NextResponse.json({ error: "persist_failed" }, { status: 500 });
  }

  if (emailJobId) {
    await applyResendEmailEventToEmailJob(supabase, emailJobId, normalized.event_type, normalized.occurred_at);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
