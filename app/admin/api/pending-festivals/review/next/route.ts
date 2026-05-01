import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { fetchAllPendingSortedIds, pickNextPendingId } from "@/lib/admin/pendingFestivalReviewQueue";
import { buildFastReviewItem } from "@/lib/admin/pendingFestivalReviewPayload";

function parseExcludeIds(raw: string | null): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export async function GET(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const excludeIds = parseExcludeIds(url.searchParams.get("exclude"));

  let sorted: Awaited<ReturnType<typeof fetchAllPendingSortedIds>>;
  try {
    sorted = await fetchAllPendingSortedIds(ctx.supabase);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[admin/api/pending-festivals/review/next] queue load failed", message);
    return NextResponse.json({ error: "Failed to load pending queue" }, { status: 500 });
  }

  const localExclude = new Set(excludeIds);
  let pickId = pickNextPendingId(sorted, localExclude);

  for (let attempt = 0; attempt < 5 && pickId; attempt++) {
    try {
      const item = await buildFastReviewItem(ctx.supabase, pickId);
      if (item) {
        return NextResponse.json({ item });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      console.error("[admin/api/pending-festivals/review/next] row load failed", { pickId, message });
      return NextResponse.json({ error: "Failed to load pending festival" }, { status: 500 });
    }
    localExclude.add(pickId);
    pickId = pickNextPendingId(sorted, localExclude);
  }

  return NextResponse.json({ item: null });
}
