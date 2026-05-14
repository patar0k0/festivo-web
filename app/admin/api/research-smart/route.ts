// app/admin/api/research-smart/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";

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
  if (!process.env.SERPAPI_KEY?.trim()) {
    return NextResponse.json({ error: "SERPAPI_KEY is not configured" }, { status: 503 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const result = await runSmartResearchPipeline(query);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Smart research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
