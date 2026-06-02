// app/admin/api/research-smart/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";
import { getCachedSmartResearch, setCachedSmartResearch } from "@/lib/admin/research/smartResearchCache";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { query?: unknown; refresh?: unknown };
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const refresh = body?.refresh === true;

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (!process.env.SERPAPI_KEY?.trim()) {
    return NextResponse.json({ error: "SERPAPI_KEY is not configured" }, { status: 503 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
  }

  // Serve from cache unless the admin explicitly asked to refresh.
  if (!refresh) {
    const cached = await getCachedSmartResearch(query);
    if (cached) {
      return NextResponse.json({ ok: true, result: cached.result, cached: true, cached_at: cached.cachedAt });
    }
  }

  try {
    const result = await runSmartResearchPipeline(query);
    // Fire-and-forget store; never let a cache write delay or fail the response.
    void setCachedSmartResearch(query, result);
    return NextResponse.json({ ok: true, result, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Smart research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
