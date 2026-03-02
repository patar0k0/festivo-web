import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const STATUS_OPTIONS = ["draft", "verified", "rejected", "archived"] as const;

function asString(value: string | null) {
  return typeof value === "string" ? value : "";
}

export async function GET(request: Request) {
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = asString(url.searchParams.get("status")) || "draft";
    const city = asString(url.searchParams.get("city"));
    const category = asString(url.searchParams.get("category"));
    const free = asString(url.searchParams.get("free"));
    const q = asString(url.searchParams.get("q"));

    const db = createSupabaseAdmin();

    let query = db
      .from("festivals")
      .select("id,title,city,start_date,end_date,category,is_free,status,updated_at,source_type")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (status && STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
      query = query.eq("status", status);
    }

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (free === "1") {
      query = query.eq("is_free", true);
    }

    if (free === "0") {
      query = query.eq("is_free", false);
    }

    if (q) {
      query = query.ilike("title", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rows: (data ?? []).map((row) => ({ ...row, id: String(row.id) })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
