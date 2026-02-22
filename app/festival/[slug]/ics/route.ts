import { NextRequest } from "next/server";
import { buildFestivalIcs } from "@/lib/ics";
import { getFestivalBySlug } from "@/lib/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const festival = await getFestivalBySlug(slug);
  if (!festival) {
    return new Response("Not found", { status: 404 });
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
