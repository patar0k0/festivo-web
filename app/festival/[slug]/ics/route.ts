import { NextResponse } from "next/server";
import { getFestivalBySlug } from "@/lib/queries";
import { buildFestivalIcs } from "@/lib/ics";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const data = await getFestivalBySlug(params.slug);
  if (!data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ics = buildFestivalIcs(data.festival);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${data.festival.slug}.ics"`,
    },
  });
}
