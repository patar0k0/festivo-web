import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";

type Payload = {
  organizer_id?: string;
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
    console.error("[follow/organizer] POST auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
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
  let supabase;
  let user;
  try {
    const ctx = await requireActiveUserWithSupabase(request);
    supabase = ctx.supabase;
    user = ctx.user;
  } catch (e) {
    const r = nextResponseForRequireActiveUserError(e);
    if (r) return r;
    console.error("[follow/organizer] DELETE auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
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
