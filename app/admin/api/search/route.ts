import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { adminPerplexityFestivalSearch } from "@/lib/research/perplexity";

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  try {
    const { urls, search_results } = await adminPerplexityFestivalSearch(q);
    return NextResponse.json({ urls, search_results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    const isConfig = message.includes("PERPLEXITY_API_KEY");
    const isBadInput = message.toLowerCase().includes("query is required");
    return NextResponse.json({ error: message }, { status: isBadInput ? 400 : isConfig ? 503 : 500 });
  }
}
