import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { researchFestival } from "@/lib/admin/research/provider";

function isValidationError(message: string): boolean {
  return (
    message.includes("end_date cannot be before start_date") ||
    message.includes("must be a valid date in YYYY-MM-DD format") ||
    message.includes("query is required")
  );
}

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
    console.info("[research:api] response payload metadata", {
      query,
      provider: result.metadata?.provider,
      mode: result.metadata?.mode,
      source_count: result.metadata?.source_count,
      source_urls: result.sources.slice(0, 3).map((source) => source.url),
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected research error";
    return NextResponse.json({ error: message }, { status: isValidationError(message) ? 400 : 500 });
  }
}
