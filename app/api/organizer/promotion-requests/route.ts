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

  const recipientEmail = getEmailAdmin() ?? (await resolveAuthUserEmail(admin, session.user.id));
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
      userId: session.user.id,
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
