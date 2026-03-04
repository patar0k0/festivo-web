import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  category_slug?: string;
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
  const categorySlug = body.category_slug?.trim();

  if (!categorySlug) {
    return NextResponse.json({ error: "Missing category_slug" }, { status: 400 });
  }

  const { error } = await supabase.from("user_followed_categories").upsert(
    {
      user_id: user.id,
      category_slug: categorySlug,
    },
    { onConflict: "user_id,category_slug", ignoreDuplicates: true },
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
  const categorySlug = body.category_slug?.trim();

  if (!categorySlug) {
    return NextResponse.json({ error: "Missing category_slug" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_followed_categories")
    .delete()
    .eq("user_id", user.id)
    .eq("category_slug", categorySlug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
