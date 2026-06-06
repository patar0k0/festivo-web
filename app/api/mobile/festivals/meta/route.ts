/**
 * GET /api/mobile/festivals/meta
 *
 * Returns category and place aggregates for the mobile discovery screen.
 * Categories and places are counted from upcoming published festivals only.
 *
 * Response shape:
 * {
 *   categories: Array<{ value: string; count: number }>,
 *   places:     Array<{ value: string; label: string; count: number }>
 * }
 */
import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import { sofiaWallClockNow } from "@/lib/festival/temporal";
import { getCityLabel } from "@/lib/settlements/getCityLabel";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

export const dynamic = "force-dynamic";

function todayYmd(): string {
  return sofiaWallClockNow().ymd;
}

type CityRow = { slug: string | null; name_bg: string | null; is_village: boolean | null } | null;

function normalizeCityJoin(raw: unknown): CityRow {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) return raw.length > 0 ? normalizeCityJoin(raw[0]) : null;
  const r = raw as Record<string, unknown>;
  return {
    slug: typeof r.slug === "string" ? r.slug : null,
    name_bg: typeof r.name_bg === "string" ? r.name_bg : null,
    is_village: typeof r.is_village === "boolean" ? r.is_village : null,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;

    const supabase = supabaseServer();
    if (!supabase) {
      return NextResponse.json({ categories: [], places: [] });
    }

    const today = todayYmd();

    const { data, error } = await supabase
      .from("festivals")
      .select("category, city_slug, cities:cities!festivals_city_id_fkey(slug,name_bg,is_village)")
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .neq("status", "archived")
      .gte("end_date", today);

    if (error) {
      console.error("[api/mobile/festivals/meta]", error.message);
      return NextResponse.json({ categories: [], places: [] });
    }

    // ── Aggregate categories ────────────────────────────────────────────────
    const catCounts = new Map<string, number>();
    const placeCounts = new Map<string, number>();
    const placeLabels = new Map<string, string>();

    for (const row of data ?? []) {
      const cat = typeof row.category === "string" ? row.category.trim() : null;
      if (cat) {
        catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
      }

      const city = normalizeCityJoin(row.cities);
      const slug = city?.slug?.trim() ?? (typeof row.city_slug === "string" ? row.city_slug.trim() : null);
      if (slug) {
        placeCounts.set(slug, (placeCounts.get(slug) ?? 0) + 1);
        if (!placeLabels.has(slug) && city) {
          const label = getCityLabel({
            name_bg: fixMojibakeBG(city.name_bg ?? slug),
            is_village: city.is_village ?? false,
          });
          placeLabels.set(slug, label);
        }
      }
    }

    const categories = [...catCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));

    const places = [...placeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({
        value,
        label: placeLabels.get(value) ?? value,
        count,
      }));

    return NextResponse.json({ categories, places });
  } catch (e) {
    console.error("[api/mobile/festivals/meta]", e);
    return NextResponse.json({ categories: [], places: [] });
  }
}
