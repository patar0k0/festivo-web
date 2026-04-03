import { NextResponse } from "next/server";

import { enqueueEmailJob } from "@/lib/email/enqueueEmail";
import { EMAIL_JOB_TYPE_TEST, isKnownEmailJobType } from "@/lib/email/emailJobTypes";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function isEnqueueClientError(message: string): boolean {
  return (
    message === "recipientEmail is required" ||
    message.startsWith("Invalid recipient email") ||
    message.startsWith("Unknown email job type:")
  );
}

export async function GET(request: Request) {
  // Phase 0-style: no public test surface in production builds.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set (required to enqueue)" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to")?.trim();
  if (!to) {
    return NextResponse.json(
      { ok: false, error: "Missing query parameter: to" },
      { status: 400 },
    );
  }

  const typeParam = searchParams.get("type")?.trim() || EMAIL_JOB_TYPE_TEST;
  if (!isKnownEmailJobType(typeParam)) {
    return NextResponse.json(
      { ok: false, error: `Unknown type (see lib/email/emailJobTypes.ts): ${typeParam}` },
      { status: 400 },
    );
  }

  const name = searchParams.get("name")?.trim() || "приятел";
  const dedupeKey = searchParams.get("dedupe")?.trim() || null;

  let payload: Record<string, unknown>;
  if (typeParam === EMAIL_JOB_TYPE_TEST) {
    payload = { name };
  } else {
    const rawPayload = searchParams.get("payload")?.trim();
    if (!rawPayload) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "For non-test types, pass URL-encoded JSON in query parameter `payload` (object with fields for that template).",
        },
        { status: 400 },
      );
    }
    try {
      const parsed: unknown = JSON.parse(rawPayload);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ ok: false, error: "payload must be a JSON object" }, { status: 400 });
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON in payload" }, { status: 400 });
    }
  }

  try {
    const supabase = createSupabaseAdmin();
    const enqueue = await enqueueEmailJob(supabase, {
      type: typeParam,
      recipientEmail: to,
      payload,
      dedupeKey,
    });

    return NextResponse.json({
      ok: true,
      queued: true,
      type: typeParam,
      outcome: enqueue.outcome,
      jobId: enqueue.jobId,
      message:
        enqueue.outcome === "existing"
          ? "Job already exists for this dedupe key"
          : "Email job enqueued; run GET /api/jobs/email to process",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "enqueue failed";
    const status = isEnqueueClientError(message) ? 400 : 500;
    if (status >= 500) {
      console.error("[test-email] enqueue failed", { message });
    } else {
      console.warn("[test-email] enqueue rejected", { message });
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
