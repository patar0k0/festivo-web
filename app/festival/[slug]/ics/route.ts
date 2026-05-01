import { NextRequest } from "next/server";
import {
  canPreviewNonPublicFestival,
  isFestivalPublicDetailCatalogVisible,
} from "@/lib/festival/detailPreviewAccess";
import { isFestivalPast } from "@/lib/festival/isFestivalPast";
import { buildFestivalIcs } from "@/lib/ics";
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

  if (!isFestivalPublicDetailCatalogVisible(festival)) {
    const canPreview = await canPreviewNonPublicFestival(festival);
    if (!canPreview) {
      return new Response("Not found", { status: 404 });
    }
  }

  if (isFestivalPast(festival)) {
    return new Response("Cannot add past festival to calendar", {
      status: 400,
    });
  }

  const icsContent = buildFestivalIcs(festival);
  return new Response(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"festivo-${slug}.ics\"`,
      "Cache-Control": "private, no-store",
      "Content-Length": Buffer.byteLength(icsContent, "utf8").toString(),
    },
  });
}
