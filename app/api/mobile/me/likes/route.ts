import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { serializeMobileFestivalListItem } from "@/lib/api/mobile/festivalSerialization";
import { FESTIVAL_SELECT_MIN } from "@/lib/queries";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Festival } from "@/lib/types";

export const dynamic = "force-dynamic";

type LikedRow = {
  created_at: string;
  festival: Festival | null;
};

export async function GET(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = createSupabaseAdmin();
    const { data, error } = await adminDb
      .from("festival_likes")
      .select(`created_at, festival:festivals(${FESTIVAL_SELECT_MIN})`)
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .returns<LikedRow[]>();

    if (error) {
      console.error("[api/mobile/me/likes]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const festivals = (data ?? [])
      .map((row) => row.festival)
      .filter((f): f is Festival => f != null)
      .map((f) => serializeMobileFestivalListItem(f, false));

    return NextResponse.json({ festivals });
  } catch (e) {
    console.error("[api/mobile/me/likes] GET", e);
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
