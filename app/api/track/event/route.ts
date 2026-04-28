import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  type?: unknown;
  meta?: unknown;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = typeof body.type === "string" ? body.type.trim() : "";
  if (!type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};

  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("email_jobs").insert({
      type: "analytics-event",
      payload: {
        type,
        meta,
        createdAt: new Date().toISOString(),
      },
      max_attempts: 1,
    });

    if (error) {
      console.error("[api/track/event] insert failed", error.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }
  } catch (error) {
    console.error("[api/track/event] insert threw", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
