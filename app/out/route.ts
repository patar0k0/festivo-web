import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_LABEL_LEN = 200;
const MAX_TARGET_LEN = 4096;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Link-preview crawlers and bots that ignore robots.txt still hit /out when a
// festival link is shared. Mirror the analytics-track bot filter so their
// fetches don't inflate outbound-click metrics.
const BOT_UA_REGEX =
  /(?:Googlebot|bingbot|YandexBot|Baiduspider|AhrefsBot|SemrushBot|DotBot|MJ12bot|PetalBot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|WhatsApp|Discordbot|Pinterest|HeadlessChrome|Lighthouse|curl\/|wget\/|python-requests|node-fetch)/i;

function jwtRoleIsAdmin(role: unknown): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Resolves the click's `user_id` and whether it should be recorded. Staff
 * (admin / super_admin) clicks are skipped so internal browsing and moderation
 * don't inflate outbound metrics — JWT claim first (no DB read), `user_roles`
 * fallback otherwise. Fail-open: any error records the click anonymously.
 */
async function resolveClickActor(): Promise<{ userId: string | null; isStaff: boolean }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    const user = error ? null : data?.user ?? null;
    if (!user) return { userId: null, isStaff: false };

    if (jwtRoleIsAdmin(user.app_metadata?.role)) {
      return { userId: user.id, isStaff: true };
    }

    const admin = supabaseAdmin();
    if (admin) {
      const { data: roleRows, error: roleError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!roleError && Array.isArray(roleRows)) {
        const isStaff = roleRows.some((r) => r.role === "admin" || r.role === "super_admin");
        if (isStaff) return { userId: user.id, isStaff: true };
      }
    }

    return { userId: user.id, isStaff: false };
  } catch {
    // Anonymous redirect is allowed; never block the redirect on auth errors.
    return { userId: null, isStaff: false };
  }
}

/** First client IP from the proxy headers Vercel sets, or "" when unavailable. */
function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() ?? "";
}

/**
 * Salted fingerprint of an anonymous visitor (IP + User-Agent) used only to
 * dedup repeated clicks. Salted with JOBS_SECRET so the stored hash can't be
 * trivially reversed to an IP. Returns null when there is no IP to hash.
 */
function computeVisitorHash(request: NextRequest, userAgent: string): string | null {
  const ip = clientIp(request);
  if (!ip) return null;
  const salt = process.env.JOBS_SECRET ?? "";
  return createHash("sha256").update(`${ip}|${userAgent}|${salt}`).digest("hex");
}

/**
 * True when the same actor already clicked the same (festival, destination_type)
 * within the dedup window. Actor = user_id for logged-in clicks, visitor_hash
 * for anonymous. Fail-open: any error (incl. missing column pre-migration)
 * returns false so the click is still recorded.
 */
async function isDuplicateClick(args: {
  admin: NonNullable<ReturnType<typeof supabaseAdmin>>;
  festivalId: string | null;
  destinationType: string;
  userId: string | null;
  visitorHash: string | null;
}): Promise<boolean> {
  if (!args.userId && !args.visitorHash) return false;

  const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  let q = args.admin
    .from("outbound_clicks")
    .select("id")
    .eq("destination_type", args.destinationType)
    .gte("created_at", since)
    .limit(1);

  q = args.festivalId ? q.eq("festival_id", args.festivalId) : q.is("festival_id", null);
  q = args.userId ? q.eq("user_id", args.userId) : q.eq("visitor_hash", args.visitorHash!);

  const { data, error } = await q;
  if (error) {
    console.warn("[outbound] dedup check failed", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

function trimLabel(value: string | null, max: number): string {
  const t = value?.trim() ?? "";
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}

function parseHttpOrHttpsUrl(raw: string | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_TARGET_LEN) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return parsed.toString();
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  const target = parseHttpOrHttpsUrl(urlParam);
  if (!target) {
    return NextResponse.json({ error: "Invalid or missing url" }, { status: 400 });
  }

  const festivalRaw = request.nextUrl.searchParams.get("festival_id");
  let festival_id: string | null = null;
  if (festivalRaw && festivalRaw.trim()) {
    const id = festivalRaw.trim();
    festival_id = UUID_RE.test(id) ? id : null;
  }

  const destination_type = trimLabel(request.nextUrl.searchParams.get("type"), MAX_LABEL_LEN) || "unknown";
  const source = trimLabel(request.nextUrl.searchParams.get("source"), MAX_LABEL_LEN) || "unknown";

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!BOT_UA_REGEX.test(userAgent)) {
    const { userId, isStaff } = await resolveClickActor();
    const admin = supabaseAdmin();
    if (admin && !isStaff) {
      const visitor_hash = userId ? null : computeVisitorHash(request, userAgent);
      const duplicate = await isDuplicateClick({
        admin,
        festivalId: festival_id,
        destinationType: destination_type,
        userId,
        visitorHash: visitor_hash,
      });
      if (!duplicate) {
        const { error: insertError } = await admin.from("outbound_clicks").insert({
          festival_id,
          user_id: userId,
          destination_type,
          target_url: target,
          source,
          visitor_hash,
        });
        if (insertError) {
          console.warn("[outbound] insert failed", insertError.message);
        }
      }
    }
  }

  return NextResponse.redirect(target, 302);
}
