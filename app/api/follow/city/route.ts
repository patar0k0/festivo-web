import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  city_slug?: string;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
