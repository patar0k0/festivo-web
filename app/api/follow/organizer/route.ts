import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  organizer_id?: string;
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
  const organizerId = body.organizer_id?.trim();

  if (!organizerId) {
    return NextResponse.json({ error: "Missing organizer_id" }, { status: 400 });
  }

  const { error } = await supabase.from("user_followed_organizers").upsert(
    {
      user_id: user.id,
      organizer_id: organizerId,
    },
    { onConflict: "user_id,organizer_id", ignoreDuplicates: true },
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
  const organizerId = body.organizer_id?.trim();

  if (!organizerId) {
    return NextResponse.json({ error: "Missing organizer_id" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_followed_organizers")
    .delete()
    .eq("user_id", user.id)
    .eq("organizer_id", organizerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
