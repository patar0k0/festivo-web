import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

type OrganizerSearchRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  verified: boolean;
};

/** Strip LIKE wildcards so user input cannot broaden the pattern. */
function sanitizeIlikeQuery(q: string): string {
  return q.replace(/[%_\\]/g, "").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("q") ?? "";
  const q = sanitizeIlikeQuery(raw);

  if (q.length < 2) {
    return NextResponse.json({ organizers: [] as OrganizerSearchRow[] });
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("organizers")
    .select("id, name, slug, logo_url, verified")
    .eq("is_active", true)
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    organizers: (data ?? []) as OrganizerSearchRow[],
  });
}
