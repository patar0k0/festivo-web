import { NextResponse } from "next/server";
import { getEmailAdmin } from "@/lib/email/config";
import { resolveAuthUserEmail } from "@/lib/email/resolveAuthUserEmail";
import {
  assertCanEditOrganizerPending,
  getPortalAdminClient,
  getPortalSessionUser,
  loadPortalPendingFestival,
} from "@/lib/organizer/portal";

type Body = {
  festivalId?: string;
};

export async function POST(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const festivalId = typeof body.festivalId === "string" ? body.festivalId.trim() : "";
  if (!festivalId) {
    return NextResponse.json({ error: "Липсва festivalId." }, { status: 400 });
  }

  const pending = await loadPortalPendingFestival(admin, festivalId);
  if (!pending) {
    return NextResponse.json({ error: "Подаването не е намерено." }, { status: 404 });
  }

  const gate = await assertCanEditOrganizerPending(admin, session.user.id, pending);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: 403 });
  }

  let festivalTitle: string | null = null;
  let city: string | null = null;
  let startDate: string | null = null;
  const { data: pendingFestivalRow, error: pendingFestivalError } = await admin
    .from("pending_festivals")
    .select("title,city_name_display,start_date")
    .eq("id", festivalId)
    .maybeSingle();
  if (pendingFestivalError) {
    console.error(
      "[api/organizer/promotion-requests] pending_festivals details query failed",
      pendingFestivalError.message,
    );
    return NextResponse.json({ error: "Неуспешно зареждане на фестивала." }, { status: 500 });
  }
  festivalTitle = pendingFestivalRow?.title?.trim() || null;
  city = pendingFestivalRow?.city_name_display?.trim() || null;
  startDate = typeof pendingFestivalRow?.start_date === "string" ? pendingFestivalRow.start_date : null;

  if (!festivalTitle || !city || !startDate) {
    const { data: festivalRow, error: festivalError } = await admin
      .from("festivals")
      .select("title,city,start_date")
      .eq("id", festivalId)
      .maybeSingle();
    if (festivalError) {
      console.error("[api/organizer/promotion-requests] festivals details query failed", festivalError.message);
      return NextResponse.json({ error: "Неуспешно зареждане на фестивала." }, { status: 500 });
    }
    festivalTitle = festivalTitle || festivalRow?.title?.trim() || null;
    city = city || festivalRow?.city?.trim() || null;
    startDate = startDate || (typeof festivalRow?.start_date === "string" ? festivalRow.start_date : null);
  }

  let organizerName: string | null = null;
  if (pending.organizer_id) {
    const { data: organizerRow, error: organizerError } = await admin
      .from("organizers")
      .select("name")
      .eq("id", pending.organizer_id)
      .maybeSingle();
    if (organizerError) {
      console.error("[api/organizer/promotion-requests] organizers name query failed", organizerError.message);
      return NextResponse.json({ error: "Неуспешно зареждане на организатора." }, { status: 500 });
    }
    organizerName = organizerRow?.name?.trim() || null;
  }

  const userEmail = await resolveAuthUserEmail(admin, session.user.id);
  if (!userEmail) {
    return NextResponse.json({ error: "Неуспешно зареждане на имейла на потребителя." }, { status: 503 });
  }

  const recipientEmail = getEmailAdmin() ?? userEmail;
  if (!recipientEmail) {
    return NextResponse.json({ error: "Липсва конфигуриран получател за заявката." }, { status: 503 });
  }

  const { error } = await admin.from("email_jobs").insert({
    type: "promotion-request",
    recipient_email: recipientEmail,
    recipient_user_id: session.user.id,
    subject: "Festivo админ — заявка за промотиране",
    payload: {
      festivalId,
      festivalTitle,
      organizerName,
      organizerId: pending.organizer_id,
      userEmail,
      city,
      startDate,
    },
    dedupe_key: `promotion-request:${festivalId}:${session.user.id}`,
    max_attempts: 1,
  });

  if (error) {
    console.error("[api/organizer/promotion-requests] insert failed", error.message);
    return NextResponse.json({ error: "Неуспешно записване на заявката." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
