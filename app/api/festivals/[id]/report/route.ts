import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { shouldEnforceTurnstile, verifyTurnstileToken, getRequestClientIp } from "@/lib/turnstile";
import { enqueueAdminEmailJobSafe } from "@/lib/email/enqueueSafe";
import { EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT } from "@/lib/email/emailJobTypes";
import { getBaseUrl } from "@/lib/config/baseUrl";

const VALID_CATEGORIES = [
  "wrong_info",
  "wrong_location",
  "broken_link",
  "event_cancelled",
  "other",
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
  wrong_info: "Грешна дата, място или цена",
  wrong_location: "Грешно местоположение на картата",
  broken_link: "Счупен линк или снимка",
  event_cancelled: "Фестивалът е отменен",
  other: "Друго",
};

function isValidCategory(v: unknown): v is Category {
  return typeof v === "string" && (VALID_CATEGORIES as readonly string[]).includes(v);
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`festivo-report:${ip}`).digest("hex").slice(0, 32);
}

// Simple in-process rate limit: 3 reports per IP per 10 min (fail-open)
const ipWindowMap = new Map<string, { count: number; resetAt: number }>();
const REPORT_LIMIT = 3;
const REPORT_WINDOW_MS = 10 * 60 * 1000;

function checkLocalRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipWindowMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipWindowMap.set(ip, { count: 1, resetAt: now + REPORT_WINDOW_MS });
    return true;
  }
  if (entry.count >= REPORT_LIMIT) return false;
  entry.count += 1;
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: festivalId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(festivalId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Turnstile verification
  const turnstileToken = typeof body.turnstileToken === "string" ? body.turnstileToken : "";
  if (shouldEnforceTurnstile()) {
    const clientIp = getRequestClientIp(request);
    const ok = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!ok) {
      return NextResponse.json(
        { error: "Проверката срещу ботове не мина. Опитай отново." },
        { status: 422 },
      );
    }
  }

  // Rate limit
  const clientIp = getRequestClientIp(request) ?? "unknown";
  if (!checkLocalRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Твърде много сигнали. Опитай след малко." },
      { status: 429 },
    );
  }

  // Validate category
  const category = body.category;
  if (!isValidCategory(category)) {
    return NextResponse.json({ error: "Невалидна категория." }, { status: 400 });
  }

  // Validate message
  const rawMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (rawMessage.length < 1) {
    return NextResponse.json({ error: "Моля, опиши проблема." }, { status: 400 });
  }
  if (rawMessage.length > 1000) {
    return NextResponse.json({ error: "Съобщението е твърде дълго (макс. 1000 символа)." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  // Verify festival exists
  const { data: festival, error: festivalErr } = await admin
    .from("festivals")
    .select("id, name, slug")
    .eq("id", festivalId)
    .maybeSingle();

  if (festivalErr || !festival) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Insert report
  const { error: insertErr } = await admin.from("festival_reports").insert({
    festival_id: festivalId,
    category,
    message: rawMessage,
    reporter_ip: hashIp(clientIp),
  });

  if (insertErr) {
    console.error("[festival_report] insert failed", insertErr.message);
    return NextResponse.json({ error: "Неуспешен запис. Опитай отново." }, { status: 500 });
  }

  // Enqueue admin email (non-fatal)
  const siteUrl = getBaseUrl().replace(/\/$/, "");
  const festivalUrl = festival.slug
    ? `${siteUrl}/festival/${festival.slug}`
    : `${siteUrl}/festival/${festival.id}`;

  await enqueueAdminEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ADMIN_FESTIVAL_REPORT,
      recipientUserId: null,
      payload: {
        festivalName: festival.name,
        festivalUrl,
        categoryLabel: CATEGORY_LABELS[category],
        message: rawMessage,
        reportedAt: new Date().toISOString(),
      },
    },
    "festival-report",
  );

  return NextResponse.json({ ok: true });
}
