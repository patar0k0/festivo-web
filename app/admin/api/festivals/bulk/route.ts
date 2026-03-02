import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/isAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Payload = {
  ids?: string[];
  status?: "verified" | "rejected" | "archived";
};

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const body = (await request.json()) as Payload;
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  const status = body.status;

  if (!ids.length || !status) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === "verified") {
    patch.is_verified = true;
  } else {
    patch.is_verified = false;
  }

  const { error } = await db.from("festivals").update(patch).in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
