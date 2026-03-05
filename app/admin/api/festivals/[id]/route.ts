import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";

type Payload = {
  title?: string;
  category?: string | null;
  city?: string | null;
  city_id?: number | string | null;
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

function parseCityId(value: Payload["city_id"]) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? value : Number.NaN;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
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

    if ("city_id" in body) {
      const cityId = parseCityId(body.city_id);
      if (Number.isNaN(cityId)) {
        return NextResponse.json({ error: "Invalid city_id" }, { status: 400 });
      }

      if (cityId === null) {
        patch.city_id = null;
      } else {
        const { data: city, error: cityError } = await ctx.supabase
          .from("cities")
          .select("slug")
          .eq("id", cityId)
          .maybeSingle<{ slug: string }>();

        if (cityError) {
          return NextResponse.json({ error: cityError.message }, { status: 500 });
        }

        if (!city?.slug) {
          return NextResponse.json({ error: "City not found" }, { status: 404 });
        }

        patch.city_id = cityId;
        patch.city = city.slug;
      }
    }

    if (Array.isArray(body.tags)) {
      patch.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
    }

    if (typeof patch.lat === "number" && (patch.lat < -90 || patch.lat > 90)) {
      return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
    }

    if (typeof patch.lng === "number" && (patch.lng < -180 || patch.lng > 180)) {
      return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
    }

    const { error } = await ctx.supabase.from("festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
