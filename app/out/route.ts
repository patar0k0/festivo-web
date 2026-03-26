import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_LABEL_LEN = 200;
const MAX_TARGET_LEN = 4096;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  let user_id: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (!error) {
      user_id = user?.id ?? null;
    }
  } catch {
    // Anonymous redirect is allowed.
  }

  const admin = supabaseAdmin();
  if (admin) {
    const { error: insertError } = await admin.from("outbound_clicks").insert({
      festival_id,
      user_id,
      destination_type,
      target_url: target,
      source,
    });
    if (insertError) {
      console.warn("[outbound] insert failed", insertError.message);
    }
  }

  return NextResponse.redirect(target, 302);
}
