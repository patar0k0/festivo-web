import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED } from "@/lib/email/emailJobTypes";
import { dedupeKeyOrganizerClaimApproved } from "@/lib/email/emailDedupeKeys";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";
import { enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import { resolveAuthUserEmail } from "@/lib/email/resolveAuthUserEmail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: row, error: loadErr } = await admin
    .from("organizer_members")
    .select("id,organizer_id,user_id,role,status,contact_email,organizer:organizers(name,slug)")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.status !== "pending") {
    return NextResponse.json({ error: "Заявката вече е обработена." }, { status: 409 });
  }

  if (row.role === "owner") {
    const { data: otherOwner, error: ownErr } = await admin
      .from("organizer_members")
      .select("id")
      .eq("organizer_id", row.organizer_id)
      .eq("role", "owner")
      .eq("status", "active")
      .neq("id", row.id)
      .limit(1)
      .maybeSingle();

    if (ownErr) {
      return NextResponse.json({ error: ownErr.message }, { status: 500 });
    }

    if (otherOwner) {
      return NextResponse.json({ error: "Вече има активен собственик за този организатор." }, { status: 409 });
    }
  }

  const { data: updatedRows, error: updErr } = await admin
    .from("organizer_members")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: ctx.user.id,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  if (!updatedRows?.length) {
    return NextResponse.json({ error: "Заявката вече е обработена." }, { status: 409 });
  }

  const org = row.organizer as { name?: string | null; slug?: string | null } | null;
  const organizerName = org?.name?.trim() || "Организатор";
  const organizerSlug = org?.slug?.trim() || null;
  const dashboardUrl = absoluteSiteUrl("/organizer/dashboard");
  const accountEmail = await resolveAuthUserEmail(admin, row.user_id);
  const recipient = accountEmail?.trim() || (typeof row.contact_email === "string" ? row.contact_email.trim() : "");
  if (recipient) {
    void enqueueEmailJobSafe(
      admin,
      {
        type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
        recipientEmail: recipient,
        recipientUserId: row.user_id,
        payload: {
          organizerName,
          organizerSlug,
          dashboardUrl,
        },
        dedupeKey: dedupeKeyOrganizerClaimApproved(row.id),
      },
      "organizer_claim_approved",
    );
  } else {
    console.warn("[email_jobs] skip organizer-claim-approved: no recipient", { member_id: row.id });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "claim.approved",
      entity_type: "claim",
      entity_id: row.id,
      route: "/admin/api/organizer-members/[id]/approve",
      method: "POST",
      details: {
        target_organizer_id: row.organizer_id,
        target_user_id: row.user_id,
        membership_role: row.role,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] claim.approved failed", { message });
  }

  return NextResponse.json({ ok: true });
}
