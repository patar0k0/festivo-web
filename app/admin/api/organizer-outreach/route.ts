import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import { EMAIL_JOB_TYPE_ORGANIZER_OUTREACH } from "@/lib/email/emailJobTypes";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";

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

  const { organizerId, recipientEmail, organizerName, festivals } = body as {
    organizerId?: string;
    recipientEmail?: string;
    organizerName?: string;
    festivals?: { title: string; url: string }[];
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
  if (!Array.isArray(festivals) || festivals.length === 0) {
    return NextResponse.json({ error: "No festivals provided" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const claimUrl = absoluteSiteUrl("/organizer/claim");

  const dedupeKey = `organizer-outreach:${organizerId}:${recipientEmail}`;

  await enqueueEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ORGANIZER_OUTREACH,
      recipientEmail,
      dedupeKey,
      payload: {
        organizerName,
        festivals,
        claimUrl,
      },
    },
    "[admin/organizer-outreach]",
  );

  return NextResponse.json({ ok: true });
}
