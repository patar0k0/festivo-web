import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { researchFestivalFromSingleUrl } from "@/lib/research/perplexity";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | { url?: unknown; search_query_hint?: unknown; snippet?: unknown }
    | null;

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const search_query_hint = typeof body?.search_query_hint === "string" ? body.search_query_hint.trim() : "";
  const snippet = typeof body?.snippet === "string" ? body.snippet : null;

  try {
    const result = await researchFestivalFromSingleUrl(url, {
      queryHint: search_query_hint || undefined,
      snippetFallback: snippet,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    const isClient =
      message.includes("Invalid URL") ||
      message.toLowerCase().includes("query is required") ||
      message.includes("not configured");
    const status = message.includes("not configured") ? 503 : isClient ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
