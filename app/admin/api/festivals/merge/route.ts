import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { computeFillNullPatch, MERGE_FILL_NULL_FIELDS } from "@/lib/admin/festivalMerge";
import type { SupabaseClient } from "@supabase/supabase-js";

type MergeBody = { winnerId?: unknown; loserId?: unknown };

// Columns needed to compute the fill-null patch.
const MERGE_SELECT = `id,status,merged_into_festival_id,tags,${MERGE_FILL_NULL_FIELDS.join(",")}`;

/** Move loser rows of a (user_id, festival_id) PK table to winner, dedup on user_id. */
async function transferUserScoped(
  svc: SupabaseClient,
  table: string,
  winnerId: string,
  loserId: string,
) {
  const { data: winnerRows } = await svc.from(table).select("user_id").eq("festival_id", winnerId);
  const winnerUsers = new Set((winnerRows ?? []).map((r) => (r as { user_id: string }).user_id));
  const { data: loserRows } = await svc.from(table).select("user_id").eq("festival_id", loserId);
  for (const row of loserRows ?? []) {
    const userId = (row as { user_id: string }).user_id;
    if (winnerUsers.has(userId)) {
      await svc.from(table).delete().eq("festival_id", loserId).eq("user_id", userId);
    } else {
      await svc.from(table).update({ festival_id: winnerId }).eq("festival_id", loserId).eq("user_id", userId);
      winnerUsers.add(userId);
    }
  }
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as MergeBody | null;
  const winnerId = typeof body?.winnerId === "string" ? body.winnerId : null;
  const loserId = typeof body?.loserId === "string" ? body.loserId : null;

  if (!winnerId || !loserId) {
    return NextResponse.json({ ok: false, error: "winnerId and loserId are required." }, { status: 400 });
  }
  if (winnerId === loserId) {
    return NextResponse.json({ ok: false, error: "Cannot merge a festival into itself." }, { status: 400 });
  }

  const svc = createSupabaseAdmin();

  const { data: festivals, error: loadErr } = await svc
    .from("festivals")
    .select(MERGE_SELECT)
    .in("id", [winnerId, loserId]);

  if (loadErr) {
    return NextResponse.json({ ok: false, error: `Load failed: ${loadErr.message}` }, { status: 500 });
  }

  const winner = (festivals ?? []).find((f) => (f as unknown as { id: string }).id === winnerId) as Record<string, unknown> | undefined;
  const loser = (festivals ?? []).find((f) => (f as unknown as { id: string }).id === loserId) as Record<string, unknown> | undefined;

  if (!winner || !loser) {
    return NextResponse.json({ ok: false, error: "Both festivals must exist." }, { status: 404 });
  }
  if (loser.status === "archived" || loser.merged_into_festival_id) {
    return NextResponse.json({ ok: false, error: "Loser is already archived or merged." }, { status: 409 });
  }

  // 1. Fill-null patch onto winner (never overwrites existing values).
  const patch = computeFillNullPatch(winner, loser);
  if (Object.keys(patch).length > 0) {
    const { error } = await svc.from("festivals").update(patch).eq("id", winnerId);
    if (error) {
      return NextResponse.json({ ok: false, error: `Winner update failed: ${error.message}` }, { status: 500 });
    }
  }

  // 2. Media — additive, dedup by url, appended after winner's max sort_order.
  const { data: winnerMedia } = await svc.from("festival_media").select("url").eq("festival_id", winnerId);
  const winnerUrls = new Set((winnerMedia ?? []).map((m) => (m as { url: string }).url));
  const { data: maxRow } = await svc
    .from("festival_media").select("sort_order").eq("festival_id", winnerId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  let nextSort = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;
  const { data: loserMedia } = await svc.from("festival_media").select("id,url").eq("festival_id", loserId);
  for (const m of loserMedia ?? []) {
    const row = m as { id: string; url: string };
    if (winnerUrls.has(row.url)) {
      await svc.from("festival_media").delete().eq("id", row.id);
    } else {
      await svc.from("festival_media").update({ festival_id: winnerId, sort_order: nextSort++ }).eq("id", row.id);
      winnerUrls.add(row.url);
    }
  }

  // 3. Organizers (m2m) — additive, dedup on organizer_id.
  const { data: winnerOrgs } = await svc.from("festival_organizers").select("organizer_id").eq("festival_id", winnerId);
  const winnerOrgIds = new Set((winnerOrgs ?? []).map((o) => (o as { organizer_id: string }).organizer_id));
  const { data: loserOrgs } = await svc.from("festival_organizers").select("organizer_id").eq("festival_id", loserId);
  for (const o of loserOrgs ?? []) {
    const orgId = (o as { organizer_id: string }).organizer_id;
    if (winnerOrgIds.has(orgId)) {
      await svc.from("festival_organizers").delete().eq("festival_id", loserId).eq("organizer_id", orgId);
    } else {
      await svc.from("festival_organizers").update({ festival_id: winnerId }).eq("festival_id", loserId).eq("organizer_id", orgId);
      winnerOrgIds.add(orgId);
    }
  }

  // 4. Followers / likes — additive, dedup on user_id.
  await transferUserScoped(svc, "user_plan_festivals", winnerId, loserId);
  await transferUserScoped(svc, "festival_likes", winnerId, loserId);

  // 5. Transient notification artifacts — delete loser's (regenerated by schedulers from moved plans).
  await svc.from("user_notifications").delete().eq("festival_id", loserId);
  await svc.from("user_plan_reminders").delete().eq("festival_id", loserId);
  await svc.from("notification_jobs").delete().eq("festival_id", loserId);

  // 6. Stats — repoint to winner (no unique constraints).
  await svc.from("outbound_clicks").update({ festival_id: winnerId }).eq("festival_id", loserId);
  await svc.from("analytics_events").update({ festival_id: winnerId }).eq("festival_id", loserId);
  await svc.from("festival_reports").update({ festival_id: winnerId }).eq("festival_id", loserId);

  // 7. Program — fill-null: move loser's days (items follow via day_id) only if winner has none.
  const { data: winnerDays } = await svc.from("festival_days").select("id").eq("festival_id", winnerId).limit(1);
  if (!winnerDays || winnerDays.length === 0) {
    await svc.from("festival_days").update({ festival_id: winnerId }).eq("festival_id", loserId);
  }

  // 8. Archive loser (recoverable; not deleted).
  const { error: archiveErr } = await svc
    .from("festivals")
    .update({ status: "archived", merged_into_festival_id: winnerId, updated_at: new Date().toISOString() })
    .eq("id", loserId);
  if (archiveErr) {
    return NextResponse.json({ ok: false, error: `Archive failed: ${archiveErr.message}` }, { status: 500 });
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival.merged",
      entity_type: "festival",
      entity_id: winnerId,
      route: "/admin/api/festivals/merge",
      method: "POST",
      details: { winner_id: winnerId, loser_id: loserId, filled_fields: Object.keys(patch) },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] festival.merged failed", { message });
  }

  return NextResponse.json({ ok: true, winner_id: winnerId, redirect_to: `/admin/festivals/${winnerId}` });
}
