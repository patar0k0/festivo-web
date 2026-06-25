import { NextResponse } from "next/server";
import {
  nextResponseForRequireActiveUserError,
  requireActiveUserWithSupabase,
} from "@/lib/auth/requireActiveUser";

export const dynamic = "force-dynamic";

type Payload = {
  organizer_id?: string;
};

/**
 * Follow state for the current user. Soft-auth: unauthenticated callers get
 * `{ authenticated: false }` (200) so the web button can render a login CTA
 * instead of erroring.
 */
export async function GET(request: Request) {
  const organizerId = new URL(request.url).searchParams.get("organizer_id")?.trim();
  if (!organizerId) {
    return NextResponse.json({ error: "Missing organizer_id" }, { status: 400 });
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
    console.error("[follow/organizer] GET auth", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("user_followed_organizers")
    .select("organizer_id")
    .eq("user_id", user.id)
    .eq("organizer_id", organizerId)
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
