import { NextResponse } from "next/server";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { getUserFestivalRole } from "@/lib/organizer/festivalAccess";

export const dynamic = "force-dynamic";

async function requireOwner(festivalId: string) {
  const session = await getPortalSessionUser();
  if (!session) {
    return {
      error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }
  const admin = getPortalAdminClient();
  try {
    const role = await getUserFestivalRole(admin, session.user.id, festivalId);
    if (role !== "owner") {
      return {
        error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "role lookup failed";
    return { error: NextResponse.json({ ok: false, error: msg }, { status: 500 }) };
  }
  return { admin, session };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const guarded = await requireOwner(festivalId);
  if ("error" in guarded) return guarded.error;
  const { admin } = guarded;

  const body = (await request.json().catch(() => null)) as
    | { organizer_id?: unknown }
    | null;
  const targetId =
    typeof body?.organizer_id === "string" ? body.organizer_id.trim() : "";
  if (!targetId) {
    return NextResponse.json(
      { ok: false, error: "organizer_id required" },
      { status: 400 },
    );
  }

  // Бърза проверка че target organizer-ът съществува и е active.
  const { data: organizer, error: orgErr } = await admin
    .from("organizers")
    .select("id")
    .eq("id", targetId)
    .eq("is_active", true)
    .maybeSingle();
  if (orgErr) {
    return NextResponse.json({ ok: false, error: orgErr.message }, { status: 500 });
  }
  if (!organizer) {
    return NextResponse.json(
      { ok: false, error: "Organizer not found" },
      { status: 404 },
    );
  }

  // Idempotent insert: ако вече е свързан (owner или co_host), не дублираме.
  const { data: existing, error: existingErr } = await admin
    .from("festival_organizers")
    .select("role")
    .eq("festival_id", festivalId)
    .eq("organizer_id", targetId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json(
      { ok: false, error: existingErr.message },
      { status: 500 },
    );
  }
  if (existing) {
    return NextResponse.json({ ok: true, already_linked: true, role: existing.role });
  }

  // Намери max(sort_order) за да добавим в края.
  const { data: maxRow } = await admin
    .from("festival_organizers")
    .select("sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error: insertErr } = await admin.from("festival_organizers").insert({
    festival_id: festivalId,
    organizer_id: targetId,
    role: "co_host",
    sort_order: nextOrder,
  });
  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: "co_host" });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;
  const guarded = await requireOwner(festivalId);
  if ("error" in guarded) return guarded.error;
  const { admin } = guarded;

  const url = new URL(request.url);
  const targetId = (url.searchParams.get("organizer_id") ?? "").trim();
  if (!targetId) {
    return NextResponse.json(
      { ok: false, error: "organizer_id required" },
      { status: 400 },
    );
  }

  // Не позволявай изтриване на owner-а през този endpoint.
  const { data: existing, error: existingErr } = await admin
    .from("festival_organizers")
    .select("role")
    .eq("festival_id", festivalId)
    .eq("organizer_id", targetId)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json(
      { ok: false, error: existingErr.message },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ ok: true, removed: false });
  }
  if (existing.role === "owner") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Owner cannot be removed. Transfer ownership first (coming soon).",
      },
      { status: 400 },
    );
  }

  const { error: deleteErr } = await admin
    .from("festival_organizers")
    .delete()
    .eq("festival_id", festivalId)
    .eq("organizer_id", targetId);
  if (deleteErr) {
    return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true });
}
