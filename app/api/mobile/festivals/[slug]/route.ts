import { NextResponse } from "next/server";
import { getCanonicalOrganizerForFestival, getMobileDbClient } from "@/lib/mobile/organizers";
import { normalizePublicFestivalSlugParam } from "@/lib/queries";

export const runtime = "nodejs";

type MobileFestivalRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  location_name: string | null;
  city_id: number | null;
  organizer_id: string | null;
  cities: { name_bg: string | null; slug: string | null } | { name_bg: string | null; slug: string | null }[] | null;
};

function firstCity(row: MobileFestivalRow["cities"]): { name_bg: string | null; slug: string | null } | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugKey = normalizePublicFestivalSlugParam(slug);
  const db = getMobileDbClient();
  if (!db) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const festivalResult = await db
    .from("festivals")
    .select("id,slug,title,description,start_date,end_date,location_name,city_id,organizer_id,cities:cities!left(name_bg,slug)")
    .eq("slug", slugKey)
    .or("status.eq.published,status.eq.verified,is_verified.eq.true")
    .neq("status", "archived")
    .maybeSingle<MobileFestivalRow>();

  if (festivalResult.error) {
    return NextResponse.json({ error: festivalResult.error.message }, { status: 500 });
  }
  if (!festivalResult.data) {
    return NextResponse.json({ error: "Festival not found" }, { status: 404 });
  }

  const festival = festivalResult.data;
  const organizer = await getCanonicalOrganizerForFestival(festival.id, festival.organizer_id);
  const city = firstCity(festival.cities);

  return NextResponse.json({
    festival: {
      id: festival.id,
      slug: festival.slug,
      title: festival.title,
      description: festival.description,
      start_date: festival.start_date,
      end_date: festival.end_date,
      location_name: festival.location_name,
      city: city ? { slug: city.slug, name: city.name_bg } : null,
      organizer: organizer
        ? {
            slug: organizer.slug,
            name: organizer.name,
          }
        : null,
    },
  });
}

