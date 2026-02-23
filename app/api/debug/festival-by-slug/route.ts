import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json(
      { ok: false, slug, data: null, error: "Missing Supabase env vars." },
      { status: 500 },
    );
  }
  if (!slug) {
    return NextResponse.json(
      { ok: false, slug, data: null, error: "Missing slug." },
      { status: 400 },
    );
  }

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from("festivals")
    .select("id,slug,title,status,is_verified,city")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, slug, data: null, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, slug, data, error: null });
}
