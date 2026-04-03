import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { EMAIL_JOB_TYPE_FESTIVAL_REJECTED } from "@/lib/email/emailJobTypes";
import { enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import { formatBgDateFromIso } from "@/lib/email/formatBg";
import { resolveAuthUserEmail } from "@/lib/email/resolveAuthUserEmail";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { data: pendingRow, error: loadErr } = await ctx.supabase
      .from("pending_festivals")
      .select("id,status,submission_source,submitted_by_user_id,title,city_name_display,start_date")
      .eq("id", id)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json({ error: loadErr.message }, { status: 500 });
    }

    if (!pendingRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (pendingRow.status !== "pending") {
      return NextResponse.json(
        { error: "Reject failed: record is not pending or does not exist." },
        { status: 409 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("pending_festivals")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: ctx.user.id,
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Reject failed: record is not pending or does not exist." }, { status: 409 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "pending_festival.rejected",
        entity_type: "pending_festival",
        entity_id: id,
        route: "/admin/api/pending-festivals/[id]/reject",
        method: "POST",
        details: {},
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[admin/audit] pending_festival.rejected failed", { message });
    }

    if (pendingRow.submission_source === "organizer_portal" && pendingRow.submitted_by_user_id) {
      try {
        const admin = createSupabaseAdmin();
        const to = await resolveAuthUserEmail(admin, pendingRow.submitted_by_user_id);
        if (to) {
          void enqueueEmailJobSafe(
            admin,
            {
              type: EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
              recipientEmail: to,
              recipientUserId: pendingRow.submitted_by_user_id,
              payload: {
                festivalTitle: pendingRow.title ?? "Фестивал",
                cityDisplay: pendingRow.city_name_display?.trim() || null,
                startDateDisplay: formatBgDateFromIso(pendingRow.start_date),
              },
              dedupeKey: `festival-rejected:${id}`,
            },
            "pending_festival_rejected_portal",
          );
        } else {
          console.warn("[email_jobs] skip festival-rejected: no auth email for submitter", {
            pending_id: id,
            submitted_by_user_id: pendingRow.submitted_by_user_id,
          });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.warn("[email_jobs] festival-rejected enqueue skipped", { pending_id: id, message });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
