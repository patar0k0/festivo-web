import { NextResponse } from "next/server";
import {
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
} from "@/lib/email/emailJobTypes";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";
import { enqueueAdminEmailJobSafe, enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { getRequestClientIp, shouldEnforceTurnstile, verifyTurnstileToken } from "@/lib/turnstile";

type Body = {
  organizer_id?: string;
  slug?: string;
  contact_email?: string;
  contact_phone?: string;
  turnstileToken?: string;
};

function parseClaimContact(body: Body): { ok: true; contact_email: string; contact_phone: string } | { ok: false; error: string } {
  const email = typeof body.contact_email === "string" ? body.contact_email.trim() : "";
  const phone = typeof body.contact_phone === "string" ? body.contact_phone.trim() : "";
  if (!email) {
    return { ok: false, error: "Имейлът за връзка е задължителен." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Невалиден имейл адрес." };
  }
  if (email.length > 320) {
    return { ok: false, error: "Имейлът е твърде дълъг." };
  }
  if (!phone) {
    return { ok: false, error: "Телефонът за връзка е задължителен." };
  }
  if (phone.length < 5 || phone.length > 40) {
    return { ok: false, error: "Посочете валиден телефон за връзка." };
  }
  return { ok: true, contact_email: email, contact_phone: phone };
}

export async function POST(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (shouldEnforceTurnstile()) {
    const ok = await verifyTurnstileToken(token, getRequestClientIp(request));
    if (!ok) {
      return NextResponse.json({ error: "Bot protection check failed." }, { status: 403 });
    }
  }

  const contact = parseClaimContact(body);
  if (!contact.ok) {
    return NextResponse.json({ error: contact.error }, { status: 400 });
  }

  let organizerId = typeof body.organizer_id === "string" ? body.organizer_id.trim() : "";

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  if (!organizerId && typeof body.slug === "string" && body.slug.trim()) {
    const { data: bySlug, error: slugErr } = await admin
      .from("organizers")
      .select("id")
      .eq("slug", body.slug.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (slugErr) {
      return NextResponse.json({ error: slugErr.message }, { status: 500 });
    }

    organizerId = bySlug?.id ?? "";
  }

  if (!organizerId) {
    return NextResponse.json({ error: "Посочете валиден организатор или slug." }, { status: 400 });
  }

  const { data: orgRow, error: orgErr } = await admin
    .from("organizers")
    .select("id,name,slug")
    .eq("id", organizerId)
    .eq("is_active", true)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  if (!orgRow) {
    return NextResponse.json({ error: "Организаторът не е намерен." }, { status: 404 });
  }

  const { data: existingOwner, error: ownErr } = await admin
    .from("organizer_members")
    .select("id")
    .eq("organizer_id", organizerId)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (ownErr) {
    return NextResponse.json({ error: ownErr.message }, { status: 500 });
  }

  if (existingOwner) {
    return NextResponse.json({ error: "Този профил вече има активен собственик. Свържете се с екипа на Festivo." }, { status: 409 });
  }

  const { data: existingMine, error: mineErr } = await admin
    .from("organizer_members")
    .select("id,status,role")
    .eq("organizer_id", organizerId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (mineErr) {
    return NextResponse.json({ error: mineErr.message }, { status: 500 });
  }

  if (existingMine) {
    if (existingMine.status === "active") {
      return NextResponse.json({ error: "Вече сте член на този профил." }, { status: 409 });
    }
    if (existingMine.status === "pending") {
      return NextResponse.json({ error: "Вече има изчакваща заявка за този профил." }, { status: 409 });
    }
    if (existingMine.status === "revoked") {
      const { error: upErr } = await admin
        .from("organizer_members")
        .update({
          status: "pending",
          role: "owner",
          approved_at: null,
          approved_by: null,
          contact_email: contact.contact_email,
          contact_phone: contact.contact_phone,
        })
        .eq("id", existingMine.id)
        .eq("status", "revoked");

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      const memberId = existingMine.id;
      const organizerName = orgRow.name?.trim() || "Организатор";
      const organizerSlug = orgRow.slug?.trim() || null;
      const organizerPortalUrl = absoluteSiteUrl("/organizer");
      const reviewUrl = absoluteSiteUrl(`/admin/organizer-claims/${memberId}`);
      void enqueueEmailJobSafe(
        admin,
        {
          type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
          recipientEmail: contact.contact_email,
          recipientUserId: session.user.id,
          payload: {
            claimId: memberId,
            organizerName,
            organizerSlug,
            organizerPortalUrl,
          },
          dedupeKey: `organizer-claim-received:${memberId}`,
        },
        "organizer_claim_created_user",
      );
      void enqueueAdminEmailJobSafe(
        admin,
        {
          type: EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
          payload: {
            claimId: memberId,
            organizerName,
            organizerSlug,
            userId: session.user.id,
            reviewUrl,
          },
          dedupeKey: `admin-new-claim:${memberId}`,
        },
        "organizer_claim_created_admin",
      );
      return NextResponse.json({ ok: true }, { status: 201 });
    }
  }

  const { data: insertedMember, error: insErr } = await admin
    .from("organizer_members")
    .insert({
      organizer_id: organizerId,
      user_id: session.user.id,
      role: "owner",
      status: "pending",
      contact_email: contact.contact_email,
      contact_phone: contact.contact_phone,
    })
    .select("id")
    .single();

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "Вече има заявка или членство за този профил." }, { status: 409 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const memberId = insertedMember?.id;
  if (memberId) {
    const organizerName = orgRow.name?.trim() || "Организатор";
    const organizerSlug = orgRow.slug?.trim() || null;
    const organizerPortalUrl = absoluteSiteUrl("/organizer");
    const reviewUrl = absoluteSiteUrl(`/admin/organizer-claims/${memberId}`);
    void enqueueEmailJobSafe(
      admin,
      {
        type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
        recipientEmail: contact.contact_email,
        recipientUserId: session.user.id,
        payload: {
          claimId: memberId,
          organizerName,
          organizerSlug,
          organizerPortalUrl,
        },
        dedupeKey: `organizer-claim-received:${memberId}`,
      },
      "organizer_claim_created_user",
    );
    void enqueueAdminEmailJobSafe(
      admin,
      {
        type: EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
        payload: {
          claimId: memberId,
          organizerName,
          organizerSlug,
          userId: session.user.id,
          reviewUrl,
        },
        dedupeKey: `admin-new-claim:${memberId}`,
      },
      "organizer_claim_created_admin",
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
