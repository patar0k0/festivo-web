import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { logAdminAction } from "@/lib/admin/audit-log";
import { getBaseUrl } from "@/lib/config/baseUrl";
import { postFestivalLinkToPage } from "@/lib/admin/facebook/postToPage";

type Payload = {
  message?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const message = (body.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ error: "Текстът на поста е празен." }, { status: 400 });
  }

  const { data: festival, error: loadError } = await ctx.supabase
    .from("festivals")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!festival?.slug) {
    return NextResponse.json({ error: "Фестивалът не е намерен." }, { status: 404 });
  }

  const link = `${getBaseUrl().replace(/\/$/, "")}/festivals/${encodeURIComponent(festival.slug)}`;

  let postId = "";
  try {
    const result = await postFestivalLinkToPage({ message, link });
    postId = result.postId;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Публикуването се провали.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const postedAt = new Date().toISOString();
  const { error: updateError } = await ctx.supabase
    .from("festivals")
    .update({ facebook_post_id: postId, facebook_posted_at: postedAt, updated_at: postedAt })
    .eq("id", id);

  if (updateError) {
    // The post is live but we failed to record it — report so the admin knows.
    return NextResponse.json(
      { error: `Публикувано, но записът се провали: ${updateError.message}`, postId, postedAt },
      { status: 500 },
    );
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "festival.facebook_posted",
      entity_type: "festival",
      entity_id: id,
      route: "/admin/api/festivals/[id]/facebook-post",
      method: "POST",
      details: { postId },
    });
  } catch (auditError) {
    const m = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] festival.facebook_posted failed", { m });
  }

  return NextResponse.json({ ok: true, postId, postedAt });
}
