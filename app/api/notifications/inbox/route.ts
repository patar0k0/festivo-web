import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

type InboxRow = {
  id: string;
  notification_type: string;
  payload_summary: string;
  deep_link: string | null;
  send_status: string;
  opened_at: string | null;
  created_at: string;
  notification_job_id: string | null;
};

function parseLimit(url: URL): number {
  const raw = Number.parseInt(url.searchParams.get("limit") ?? `${PAGE_SIZE_DEFAULT}`, 10);
  if (!Number.isFinite(raw) || raw <= 0) return PAGE_SIZE_DEFAULT;
  return Math.min(raw, PAGE_SIZE_MAX);
}

export async function GET(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = parseLimit(url);
  const cursor = url.searchParams.get("cursor");
  let query = supabase
    .from("push_delivery_audit")
    .select("id,notification_type,payload_summary,deep_link,send_status,opened_at,created_at,notification_job_id")
    .eq("user_id", user.id)
    .in("send_status", ["sent", "skipped"])
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as InboxRow[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.created_at ?? null : null;

  return NextResponse.json({
    items: page.map((r) => ({
      id: r.id,
      notificationId: r.notification_job_id ?? r.id,
      type: r.notification_type,
      summary: r.payload_summary,
      deepLink: r.deep_link,
      status: r.send_status,
      openedAt: r.opened_at,
      createdAt: r.created_at,
      unread: !r.opened_at,
    })),
    pageInfo: {
      hasMore,
      nextCursor,
      limit,
    },
  });
}
