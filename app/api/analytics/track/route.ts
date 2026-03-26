import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalyticsEvent } from "@/lib/analytics/types";
import { isAnalyticsEvent } from "@/lib/analytics/types";

type AnalyticsTrackBody = {
  event?: string;
  notification_id?: string | null;
  festival_id?: string | null;
  slug?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

function toOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  let body: AnalyticsTrackBody;
  try {
    body = (await request.json()) as AnalyticsTrackBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const event = typeof body.event === "string" ? body.event : null;
  if (!event || !isAnalyticsEvent(event)) {
    return NextResponse.json({ ok: false, error: "Invalid or missing event" }, { status: 400 });
  }

  const notification_id = toOptionalTrimmedString(body.notification_id);
  const festival_id = toOptionalTrimmedString(body.festival_id);
  const slug = toOptionalTrimmedString(body.slug);
  const source = toOptionalTrimmedString(body.source);
  const metadata_json = body.metadata && typeof body.metadata === "object" ? body.metadata : null;

  let user_id: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.warn("[analytics] failed to read session user", { error: error.message });
    } else {
      user_id = user?.id ?? null;
    }
  } catch (err) {
    // Anonymous tracking is allowed; do not block.
    console.warn("[analytics] session read failed; tracking anonymously", err);
  }

  const created_at = new Date().toISOString();
  const payload = {
    user_id,
    event: event as AnalyticsEvent,
    notification_id,
    festival_id,
    slug,
    source,
    metadata_json,
    created_at,
  };

  try {
    const supabaseAdmin = createSupabaseAdmin();
    const { error: insertError } = await supabaseAdmin.from("analytics_events").insert(payload);
    if (insertError) {
      console.warn("[analytics] insert failed", { event, message: insertError.message });
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    // Fail-safe: do not block client flows for analytics.
    console.warn("[analytics] insert threw", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

