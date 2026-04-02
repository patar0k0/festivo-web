import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";

type Payload = {
  ids?: string[];
  status?: "verified" | "rejected" | "archived";
};

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Payload;
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    const status = body.status;

    if (!ids.length || !status) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "verified") {
      patch.is_verified = true;
    } else {
      patch.is_verified = false;
    }

    const { error } = await ctx.supabase.from("festivals").update(patch).in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await logAdminAction({
        actor_user_id: ctx.user.id,
        action: "festival.bulk_status_updated",
        entity_type: "festival",
        route: "/admin/api/festivals/bulk",
        method: "POST",
        details: {
          status,
          ids_count: ids.length,
        },
      });
    } catch (auditError) {
      const message = auditError instanceof Error ? auditError.message : "unknown";
      console.error("[admin/audit] festival.bulk_status_updated failed", { message });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
