import { NextResponse } from "next/server";

import { EMAIL_JOB_TYPE_TEST } from "@/lib/email/emailJobTypes";
import { enqueueEmailJob } from "@/lib/email/enqueueEmail";
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

  const name = searchParams.get("name")?.trim() || "приятел";
  const dedupeKey = searchParams.get("dedupe")?.trim() || null;

  try {
    const supabase = createSupabaseAdmin();
    const enqueue = await enqueueEmailJob(supabase, {
      type: EMAIL_JOB_TYPE_TEST,
      recipientEmail: to,
      payload: { name },
      dedupeKey,
    });

    return NextResponse.json({
      ok: true,
      queued: true,
      outcome: enqueue.outcome,
      jobId: enqueue.jobId,
      message:
        enqueue.outcome === "existing"
          ? "Job already exists for this dedupe key"
          : "Test email job enqueued; run GET /api/jobs/email to process",
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
