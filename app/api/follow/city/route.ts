import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";

type Payload = {
  city_slug?: string;
};

export async function POST(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[follow/city] POST auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  const body = (await request.json()) as Payload;
  const citySlug = body.city_slug?.trim();

  if (!citySlug) {
    return NextResponse.json({ error: "Missing city_slug" }, { status: 400 });
  }

  const { error } = await supabase.from("user_followed_cities").upsert(
    {
      user_id: user.id,
      city_slug: citySlug,
    },
    { onConflict: "user_id,city_slug", ignoreDuplicates: true },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[follow/city] DELETE auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  const body = (await request.json()) as Payload;
  const citySlug = body.city_slug?.trim();

  if (!citySlug) {
    return NextResponse.json({ error: "Missing city_slug" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_followed_cities")
    .delete()
    .eq("user_id", user.id)
    .eq("city_slug", citySlug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
