import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isSupportedVideoPageUrl } from "@/lib/festival/videoEmbed";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: pendingId } = await params;
    const body = (await request.json().catch(() => null)) as { video_url?: unknown } | null;
    const raw = typeof body?.video_url === "string" ? body.video_url.trim() : "";

    if (raw && !isSupportedVideoPageUrl(raw)) {
      return NextResponse.json(
        { error: "Поддържани са само публични линкове към YouTube или Facebook видео." },
        { status: 400 },
      );
    }

    const { error } = await ctx.supabase.from("pending_festivals").update({ video_url: raw || null }).eq("id", pendingId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, video_url: raw || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
