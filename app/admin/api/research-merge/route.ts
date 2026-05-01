import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { mergeSelectedResearchUrls } from "@/lib/research/mergeSelectedSources";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        urls?: unknown;
        query?: unknown;
        snippets_by_url?: unknown;
      }
    | null;

  const urlsRaw = body?.urls;
  if (!Array.isArray(urlsRaw)) {
    return NextResponse.json({ error: "urls array is required" }, { status: 400 });
  }
  const urls = urlsRaw.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  const query = typeof body?.query === "string" ? body.query : "";

  const snippets_by_url: Record<string, string | null> = {};
  if (body?.snippets_by_url && typeof body.snippets_by_url === "object" && !Array.isArray(body.snippets_by_url)) {
    for (const [k, v] of Object.entries(body.snippets_by_url as Record<string, unknown>)) {
      if (typeof v === "string") snippets_by_url[k] = v;
    }
  }

  try {
    const out = await mergeSelectedResearchUrls(urls, query, {
      snippetsByUrl: snippets_by_url,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Merge failed";
    const isClient =
      message.includes("At least one URL") ||
      message.includes("At most") ||
      message.includes("No valid extracted");
    const status = isClient ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
