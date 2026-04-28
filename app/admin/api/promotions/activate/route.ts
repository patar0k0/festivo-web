import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

type ActivatePromotionBody = {
  festivalId?: string;
};

export async function POST(req: Request) {
  const ctx = await getAdminContext();

  if (!ctx?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as ActivatePromotionBody;
  const festivalId = body.festivalId?.trim();

  if (!festivalId) {
    return NextResponse.json({ error: "Missing festivalId" }, { status: 400 });
  }

  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { error } = await ctx.supabase
    .from("festivals")
    .update({
      promotion_status: "promoted",
      promotion_started_at: now.toISOString(),
      promotion_expires_at: expires.toISOString(),
    })
    .eq("id", festivalId);

  if (error) {
    console.error("[activate promotion]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
