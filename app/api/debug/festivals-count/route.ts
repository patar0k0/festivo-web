import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    deployment: process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 10) ?? null,
    now: new Date().toISOString(),
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return NextResponse.json({ ok: false, count: null, error: "Missing Supabase env vars." }, { status: 500 });
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error } = await supabase
    .from("festivals")
    .select("id", { count: "exact", head: true })
    .eq("status", "verified");

  if (error) {
    return NextResponse.json({ ok: false, count: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count, error: null }, { status: 200 });
}
