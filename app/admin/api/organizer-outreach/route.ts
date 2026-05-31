import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import { EMAIL_JOB_TYPE_ORGANIZER_OUTREACH } from "@/lib/email/emailJobTypes";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const organizerId = searchParams.get("organizerId");
  if (!organizerId) {
    return NextResponse.json({ error: "Missing organizerId" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("email_jobs")
    .select("id,recipient_email,status,sent_at,created_at,last_error")
    .eq("type", EMAIL_JOB_TYPE_ORGANIZER_OUTREACH)
    .like("dedupe_key", `organizer-outreach:${organizerId}:%`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { organizerId, recipientEmail, organizerName, festivals, subject, rawBody } = body as {
    organizerId?: string;
    recipientEmail?: string;
    organizerName?: string;
    festivals?: { title: string; url: string }[];
    subject?: string;
    rawBody?: string;
  };

  if (!organizerId || typeof organizerId !== "string") {
    return NextResponse.json({ error: "Missing organizerId" }, { status: 400 });
  }
  if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
    return NextResponse.json({ error: "Missing or invalid recipientEmail" }, { status: 400 });
  }
  if (!organizerName || typeof organizerName !== "string") {
    return NextResponse.json({ error: "Missing organizerName" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const claimUrl = absoluteSiteUrl("/organizer/claim");
  // Include date so the same organizer+email can receive follow-ups on different days,
  // but accidental double-clicks on the same day are still deduplicated.
  const today = new Date().toISOString().slice(0, 10);
  const dedupeKey = `organizer-outreach:${organizerId}:${recipientEmail}:${today}`;

  await enqueueEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ORGANIZER_OUTREACH,
      recipientEmail,
      subject: subject?.trim() || undefined,
      dedupeKey,
      payload: {
        organizerName,
        festivals: festivals ?? [],
        claimUrl,
        // Raw body from the modal — when present, used as-is instead of the React template
        rawBody: rawBody?.trim() || undefined,
      },
    },
    "[admin/organizer-outreach]",
  );

  return NextResponse.json({ ok: true });
}
