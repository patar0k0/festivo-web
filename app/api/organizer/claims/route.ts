import { NextResponse } from "next/server";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";

type Body = {
  organizer_id?: string;
  slug?: string;
};

export async function POST(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  let organizerId = typeof body.organizer_id === "string" ? body.organizer_id.trim() : "";

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  if (!organizerId && typeof body.slug === "string" && body.slug.trim()) {
    const { data: bySlug, error: slugErr } = await admin
      .from("organizers")
      .select("id")
      .eq("slug", body.slug.trim())
      .eq("is_active", true)
      .maybeSingle();

    if (slugErr) {
      return NextResponse.json({ error: slugErr.message }, { status: 500 });
    }

    organizerId = bySlug?.id ?? "";
  }

  if (!organizerId) {
    return NextResponse.json({ error: "Посочете валиден организатор или slug." }, { status: 400 });
  }

  const { data: orgOk, error: orgErr } = await admin
    .from("organizers")
    .select("id")
    .eq("id", organizerId)
    .eq("is_active", true)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  if (!orgOk) {
    return NextResponse.json({ error: "Организаторът не е намерен." }, { status: 404 });
  }

  const { data: existingOwner, error: ownErr } = await admin
    .from("organizer_members")
    .select("id")
    .eq("organizer_id", organizerId)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (ownErr) {
    return NextResponse.json({ error: ownErr.message }, { status: 500 });
  }

  if (existingOwner) {
    return NextResponse.json({ error: "Този профил вече има активен собственик. Свържете се с екипа на Festivo." }, { status: 409 });
  }

  const { data: existingMine, error: mineErr } = await admin
    .from("organizer_members")
    .select("id,status,role")
    .eq("organizer_id", organizerId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (mineErr) {
    return NextResponse.json({ error: mineErr.message }, { status: 500 });
  }

  if (existingMine) {
    if (existingMine.status === "active") {
      return NextResponse.json({ error: "Вече сте член на този профил." }, { status: 409 });
    }
    if (existingMine.status === "pending") {
      return NextResponse.json({ error: "Вече има изчакваща заявка за този профил." }, { status: 409 });
    }
    if (existingMine.status === "revoked") {
      const { error: upErr } = await admin
        .from("organizer_members")
        .update({
          status: "pending",
          role: "owner",
          approved_at: null,
          approved_by: null,
        })
        .eq("id", existingMine.id)
        .eq("status", "revoked");

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true }, { status: 201 });
    }
  }

  const { error: insErr } = await admin.from("organizer_members").insert({
    organizer_id: organizerId,
    user_id: session.user.id,
    role: "owner",
    status: "pending",
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "Вече има заявка или членство за този профил." }, { status: 409 });
    }
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
