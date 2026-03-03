import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

type Payload = {
  ids?: string[];
  status?: "verified" | "rejected" | "archived";
};

export async function POST(request: Request) {
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    const { error } = await admin.client.from("festivals").update(patch).in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
