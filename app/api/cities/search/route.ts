import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { rankCitySuggestions, type CitySuggestion } from "@/lib/cities/citySearch";

const MAX_SUGGESTIONS = 8;

export async function GET(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json({ suggestions: [], hasExactMatch: false, normalizedInput: "" });
  }

  const [byName, bySlug] = await Promise.all([
    admin.from("cities").select("id,name_bg,slug,is_village").ilike("name_bg", `%${q}%`).limit(MAX_SUGGESTIONS),
    admin.from("cities").select("id,name_bg,slug,is_village").ilike("slug", `%${q}%`).limit(MAX_SUGGESTIONS),
  ]);

  if (byName.error || bySlug.error) {
    console.error("[api/cities/search] query failed", {
      name: byName.error?.message ?? null,
      slug: bySlug.error?.message ?? null,
    });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  const rows = [...(byName.data ?? []), ...(bySlug.data ?? [])] as CitySuggestion[];
  return NextResponse.json(rankCitySuggestions(rows, q, MAX_SUGGESTIONS));
}
