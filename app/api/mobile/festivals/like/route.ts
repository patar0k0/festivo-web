import { NextResponse } from "next/server";
import { mobileAuthErrorResponse, resolveMobileRequestAuth } from "@/lib/api/mobile/resolveMobileAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BodyPayload = { festivalId?: string };

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function parseFestivalId(request: Request): Promise<string | Response> {
  let body: BodyPayload;
  try {
    body = (await request.json()) as BodyPayload;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const festivalId = typeof body.festivalId === "string" ? body.festivalId.trim() : "";
  if (!festivalId) return jsonError("Missing festivalId", 400);
  if (!UUID_RE.test(festivalId)) return jsonError("Invalid festivalId", 400);
  return festivalId;
}

async function countLikes(adminDb: ReturnType<typeof createSupabaseAdmin>, festivalId: string): Promise<number> {
  const { count, error } = await adminDb
    .from("festival_likes")
    .select("festival_id", { count: "exact", head: true })
    .eq("festival_id", festivalId);
  if (error) {
    console.warn("[api/mobile/festivals/like] count error", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function POST(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return jsonError("Unauthorized", 401);

    const festivalIdOrResponse = await parseFestivalId(request);
    if (festivalIdOrResponse instanceof Response) return festivalIdOrResponse;
    const festivalId = festivalIdOrResponse;

    const adminDb = createSupabaseAdmin();
    const { error: insertError } = await adminDb
      .from("festival_likes")
      .insert({ user_id: auth.user.id, festival_id: festivalId });

    // 23505 = unique violation (already liked); treat as success
    if (insertError && insertError.code !== "23505") {
      if (insertError.code === "23503") return jsonError("Festival not found", 404);
      console.error("[api/mobile/festivals/like] insert error", {
        code: insertError.code,
        message: insertError.message,
        userId: auth.user.id,
        festivalId,
      });
      return jsonError(insertError.message, 500);
    }

    const likesCount = await countLikes(adminDb, festivalId);
    return NextResponse.json({ liked: true, festivalId, likes_count: likesCount });
  } catch (error) {
    console.error("[api/mobile/festivals/like] POST", error);
    const message = error instanceof Error ? error.message : "Failed to like festival";
    return jsonError(message, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await resolveMobileRequestAuth(request);
    const authErr = mobileAuthErrorResponse(auth);
    if (authErr) return authErr;
    if (!auth.user) return jsonError("Unauthorized", 401);

    const festivalIdOrResponse = await parseFestivalId(request);
    if (festivalIdOrResponse instanceof Response) return festivalIdOrResponse;
    const festivalId = festivalIdOrResponse;

    const adminDb = createSupabaseAdmin();
    const { error: deleteError } = await adminDb
      .from("festival_likes")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("festival_id", festivalId);

    if (deleteError) {
      console.error("[api/mobile/festivals/like] delete error", {
        code: deleteError.code,
        message: deleteError.message,
        userId: auth.user.id,
        festivalId,
      });
      return jsonError(deleteError.message, 500);
    }

    const likesCount = await countLikes(adminDb, festivalId);
    return NextResponse.json({ liked: false, festivalId, likes_count: likesCount });
  } catch (error) {
    console.error("[api/mobile/festivals/like] DELETE", error);
    const message = error instanceof Error ? error.message : "Failed to unlike festival";
    return jsonError(message, 500);
  }
}
