import { NextResponse } from "next/server";
import { normalizeOrganizerName, pickOrganizerSlug } from "@/lib/admin/organizers";
import { transliteratedSlug } from "@/lib/text/slug";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { getRequestClientIp, shouldEnforceTurnstile, verifyTurnstileToken } from "@/lib/turnstile";

type Body = {
  name?: string;
  description?: string | null;
  website_url?: string | null;
  email?: string | null;
  turnstileToken?: string;
};

export async function POST(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  const token = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (shouldEnforceTurnstile()) {
    const ok = await verifyTurnstileToken(token, getRequestClientIp(request));
    if (!ok) {
      return NextResponse.json({ error: "Bot protection check failed." }, { status: 403 });
    }
  }
  const name = normalizeOrganizerName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Името на организатора е задължително." }, { status: 400 });
  }

  const slugBase = transliteratedSlug(name);
  if (!slugBase) {
    return NextResponse.json({ error: "Неуспешно генериране на адрес (slug)." }, { status: 400 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const slug = await pickOrganizerSlug(admin, slugBase);

  const orgPayload = {
    name,
    slug,
    description: normalizeOrganizerName(body.description) ?? null,
    website_url: normalizeOrganizerName(body.website_url) ?? null,
    email: normalizeOrganizerName(body.email) ?? null,
    is_active: true,
  };

  const { data: orgRow, error: orgErr } = await admin.from("organizers").insert(orgPayload).select("id,name,slug").single();

  if (orgErr) {
    console.error("[api/organizer/organizers] insert organizer", orgErr.message);
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  const { error: memErr } = await admin.from("organizer_members").insert({
    organizer_id: orgRow.id,
    user_id: session.user.id,
    role: "owner",
    status: "active",
    approved_at: new Date().toISOString(),
    approved_by: session.user.id,
  });

  if (memErr) {
    await admin.from("organizers").delete().eq("id", orgRow.id);
    console.error("[api/organizer/organizers] insert member", memErr.message);
    return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  return NextResponse.json({ organizer: orgRow }, { status: 201 });
}
