import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { researchFestival } from "@/lib/admin/research/provider";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const result = await researchFestival(query);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected research error";
    const status =
      message.includes("end_date cannot be before start_date") ||
      message.includes("must be a valid date in YYYY-MM-DD format")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
