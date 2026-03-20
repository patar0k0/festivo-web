import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { researchFestival } from "@/lib/research/perplexity";

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
    const message = error instanceof Error ? error.message : "AI research failed";
    const status = message.toLowerCase().includes("query is required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
