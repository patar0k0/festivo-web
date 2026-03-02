import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type Payload = {
  title?: string;
  category?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  image_url?: string | null;
  website_url?: string | null;
  ticket_url?: string | null;
  price_range?: string | null;
  lat?: number | null;
  lng?: number | null;
  is_free?: boolean;
  is_verified?: boolean;
  status?: "draft" | "verified" | "rejected" | "archived";
  tags?: string[];
  description?: string | null;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminContext();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = createSupabaseAdmin();
    const { id } = await params;
    const body = (await request.json()) as Payload;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const allowedKeys: Array<keyof Payload> = [
      "title",
      "category",
      "city",
      "region",
      "address",
      "start_date",
      "end_date",
      "image_url",
      "website_url",
      "ticket_url",
      "price_range",
      "lat",
      "lng",
      "is_free",
      "is_verified",
      "status",
      "tags",
      "description",
    ];

    allowedKeys.forEach((key) => {
      if (key in body) {
        patch[key] = body[key];
      }
    });

    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
    }

    if (typeof patch.lat === "number" && (patch.lat < -90 || patch.lat > 90)) {
      return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
    }

    if (typeof patch.lng === "number" && (patch.lng < -180 || patch.lng > 180)) {
      return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
    }

    const { error } = await db.from("festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
