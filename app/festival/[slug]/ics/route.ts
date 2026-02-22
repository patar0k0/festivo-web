import { NextRequest } from "next/server";
import { buildFestivalIcs } from "@/lib/ics";
import { supabaseServer } from "@/lib/supabaseServer";
import { FestivalIcsData } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from<FestivalIcsData>("festivals")
    .select("title, slug, start_date, end_date, city, address, website_url")
    .eq("slug", slug)
    .eq("status", "verified")
    .single();

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  const ics = buildFestivalIcs(data);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename=\"festivo-${slug}.ics\"`,
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
