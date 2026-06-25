import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";

export const dynamic = "force-dynamic";

type Payload = {
  city_slug?: string;
};

/**
 * Follow state for the current user. Soft-auth: unauthenticated callers get
 * `{ authenticated: false }` (200) so the web button can render a login CTA
 * instead of erroring.
 */
export async function GET(request: Request) {
  const citySlug = new URL(request.url).searchParams.get("city_slug")?.trim();
  if (!citySlug) {
    return NextResponse.json({ error: "Missing city_slug" }, { status: 400 });
  }

  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    if (e instanceof Error && (e.message === "Unauthorized" || e.message === "User is deleted")) {
      return NextResponse.json({ authenticated: false, following: false });
    }
    console.error("[follow/city] GET auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("user_followed_cities")
    .select("city_slug")
    .eq("user_id", user.id)
    .eq("city_slug", citySlug)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ authenticated: true, following: Boolean(data) });
}

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
