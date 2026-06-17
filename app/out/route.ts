import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
      const { error: insertError } = await admin.from("outbound_clicks").insert({
        festival_id,
        user_id: userId,
        destination_type,
        target_url: target,
        source,
      });
      if (insertError) {
        console.warn("[outbound] insert failed", insertError.message);
      }
    }
  }

  return NextResponse.redirect(target, 302);
}
