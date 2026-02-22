import { NextRequest } from "next/server";
import { getFestivalBySlug } from "@/lib/queries";
import { buildFestivalIcs } from "@/lib/ics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const data = await getFestivalBySlug(slug);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const ics = buildFestivalIcs(data.festival);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"festivo-${slug}.ics\"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
