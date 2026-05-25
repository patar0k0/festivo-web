import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { buildFastReviewItem } from "@/lib/admin/pendingFestivalReviewPayload";
import { countPendingFestivals, fetchNextPendingReviewId } from "@/lib/admin/pendingFestivalReviewQueue";

function parseExcludeIds(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const excludeIds = parseExcludeIds(url.searchParams.get("exclude"));

  let pendingCount: number;
  try {
    pendingCount = await countPendingFestivals(ctx.supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[admin/api/pending-festivals/review/next] count failed", message);
    return NextResponse.json({ error: "Failed to count pending festivals" }, { status: 500 });
  }

  const tried = new Set(excludeIds);
  let pickId: string | null = null;

  try {
    pickId = await fetchNextPendingReviewId(ctx.supabase, { excludeIds: [...tried] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[admin/api/pending-festivals/review/next] queue pick failed", message);
    return NextResponse.json({ error: "Failed to load pending queue" }, { status: 500 });
  }

  for (let attempt = 0; attempt < 5 && pickId; attempt++) {
    try {
      const item = await buildFastReviewItem(ctx.supabase, pickId);
      if (item) {
        return NextResponse.json({ item, pending_count: pendingCount });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      console.error("[admin/api/pending-festivals/review/next] row load failed", { pickId, message });
      return NextResponse.json({ error: "Failed to load pending festival" }, { status: 500 });
    }
    tried.add(pickId);
    try {
      pickId = await fetchNextPendingReviewId(ctx.supabase, { excludeIds: [...tried] });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      console.error("[admin/api/pending-festivals/review/next] queue retry failed", message);
      return NextResponse.json({ error: "Failed to load pending queue" }, { status: 500 });
    }
  }

  return NextResponse.json({ item: null, pending_count: pendingCount });
}
