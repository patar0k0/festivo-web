import { NextRequest } from "next/server";
import { buildFestivalIcs } from "@/lib/ics";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { getFestivalBySlug, normalizePublicFestivalSlugParam } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = normalizePublicFestivalSlugParam(rawSlug);
  const festival = await getFestivalBySlug(slug);
  if (!festival) {
    return new Response("Not found", { status: 404 });
  }

  if (isFestivalPast(festival)) {
    return new Response("Cannot add past festival to calendar", {
      status: 400,
    });
  }

  const ics = buildFestivalIcs(festival);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"festivo-${slug}.ics\"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
