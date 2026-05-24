import { NextResponse } from "next/server";

import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const DEFAULT_PER_PAGE = 50;
const MAX_PER_PAGE = 100;

function parsePositiveInt(raw: string | null, fallback: number, max?: number): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) return fallback;
  return max != null && n > max ? max : n;
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const perPage = parsePositiveInt(url.searchParams.get("perPage"), DEFAULT_PER_PAGE, MAX_PER_PAGE);
  const reviewedParam = url.searchParams.get("reviewed");

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let query = admin
    .from("festival_reports")
    .select(
      "id, festival_id, category, message, reporter_ip, created_at, reviewed, reviewed_at, festival:festivals(id, name, slug)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (reviewedParam === "0") {
    query = query.eq("reviewed", false);
  } else if (reviewedParam === "1") {
    query = query.eq("reviewed", true);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[admin/festival-reports] query failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [], total: count ?? 0, page, perPage });
}
