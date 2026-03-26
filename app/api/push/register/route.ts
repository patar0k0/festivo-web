import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type Payload = {
  token?: string;
  platform?: string;
};

const ALLOWED_PLATFORMS = new Set(["android", "ios", "web"]);

function parseNonEmptyTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const token = parseNonEmptyTrimmedString(body.token);
  const platform = parseNonEmptyTrimmedString(body.platform)?.toLowerCase();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }
  if (!platform || !ALLOWED_PLATFORMS.has(platform)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid platform" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ ok: false, error: authError.message }, { status: 500 });
  }

  if (!user) {
    // `device_tokens` RLS is defined for `to authenticated` and rows require `user_id`.
    return NextResponse.json(
      { ok: false, error: "Unauthorized: sign in required to register push token" },
      { status: 401 },
    );
  }

  const nowIso = new Date().toISOString();

  const invalidateOthers = async (chosenId: string) => {
    const { error } = await supabase
      .from("device_tokens")
      .update({ invalidated_at: nowIso })
      .eq("user_id", user.id)
      .eq("token", token)
      .is("invalidated_at", null)
      .neq("id", chosenId);

    // Invalidation is a best-effort cleanup; registration still should succeed.
    if (error) {
      console.warn("[push/register] invalidate others failed", { message: error.message });
    }
  };

  // 1) Reactivate/update an existing *active* token row (avoid insert churn).
  const { data: activeRows, error: activeErr } = await supabase
    .from("device_tokens")
    .select("id")
    .eq("user_id", user.id)
    .eq("token", token)
    .is("invalidated_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (activeErr) {
    return NextResponse.json({ ok: false, error: activeErr.message }, { status: 500 });
  }

  if (activeRows?.length) {
    const chosenId = activeRows[0].id as string;

    const { error: updateErr } = await supabase
      .from("device_tokens")
      .update({ platform, invalidated_at: null })
      .eq("id", chosenId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    await invalidateOthers(chosenId);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 2) No active row: reactivate an older row if it exists.
  const { data: anyRows, error: anyErr } = await supabase
    .from("device_tokens")
    .select("id")
    .eq("user_id", user.id)
    .eq("token", token)
    .order("created_at", { ascending: false })
    .limit(1);

  if (anyErr) {
    return NextResponse.json({ ok: false, error: anyErr.message }, { status: 500 });
  }

  if (anyRows?.length) {
    const chosenId = anyRows[0].id as string;

    const { error: updateErr } = await supabase
      .from("device_tokens")
      .update({ platform, invalidated_at: null })
      .eq("id", chosenId);

    if (updateErr) {
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    // Defensive: if duplicates exist for some reason, keep only this row active.
    await invalidateOthers(chosenId);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // 3) Brand new token: insert a row as active.
  const { data: inserted, error: insertErr } = await supabase
    .from("device_tokens")
    .insert({ user_id: user.id, token, platform, invalidated_at: null })
    .select("id")
    .maybeSingle();

  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
  }

  const chosenId = inserted?.id as string | undefined;
  if (chosenId) {
    await invalidateOthers(chosenId);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

