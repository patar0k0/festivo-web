import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FESTIVAL_SELECT =
  "id,title,slug,city,city_slug,region,start_date,end_date,category,image_url,is_free,status,is_verified,lat,lng,description,ticket_url,price_range";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!request.cookies.get("festivo_preview")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, count, error } = await supabase
      .from("festivals")
      .select(FESTIVAL_SELECT, { count: "exact" })
      .or("status.eq.published,status.eq.verified,is_verified.eq.true")
      .order("start_date", { ascending: true })
      .range(0, 0);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: JSON.parse(JSON.stringify(error)),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      count: count ?? 0,
      sample: data?.[0] ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? { message: error.message } : { message: "Unknown error" },
      },
      { status: 500 }
    );
  }
}
