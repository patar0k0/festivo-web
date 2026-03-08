import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { normalizeSettlementInput, resolveCityReference } from "@/lib/admin/resolveCityReference";

type Payload = {
  title?: string;
  slug?: string | null;
  description?: string | null;
  city?: string | null;
  city_id?: number | string | null;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  organizer_name?: string | null;
  source_url?: string | null;
  is_free?: boolean;
  hero_image?: string | null;
  tags?: unknown;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as Payload;

    const patch: Record<string, unknown> = {};
    const allowedKeys: Array<keyof Payload> = [
      "title",
      "slug",
      "description",
      "city_id",
      "location_name",
      "latitude",
      "longitude",
      "start_date",
      "end_date",
      "organizer_name",
      "source_url",
      "is_free",
      "hero_image",
      "tags",
    ];

    allowedKeys.forEach((key) => {
      if (key in body) {
        patch[key] = body[key];
      }
    });

    if ("city" in body) {
      const cityInput = typeof body.city === "string" ? normalizeSettlementInput(body.city) : "";

      if (!cityInput) {
        patch.city_id = null;
      } else {
        const resolvedCity = await resolveCityReference(ctx.supabase, cityInput);
        if (resolvedCity) {
          patch.city_id = resolvedCity.id;
          if (typeof body.location_name !== "string" || !normalizeSettlementInput(body.location_name)) {
            patch.location_name = null;
          }
        } else {
          patch.city_id = null;
          patch.location_name = cityInput;
        }
      }
    } else if ("city_id" in body) {
      if (body.city_id === null || body.city_id === undefined || body.city_id === "") {
        patch.city_id = null;
      } else {
        return NextResponse.json({ error: "city_id updates are no longer supported directly. Use city text input." }, { status: 400 });
      }
    }

    if ("tags" in body) {
      if (Array.isArray(body.tags)) {
        patch.tags = body.tags.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
      } else if (body.tags === null) {
        patch.tags = [];
      } else {
        return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
      }
    }

    if (typeof patch.latitude === "number" && (patch.latitude < -90 || patch.latitude > 90)) {
      return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
    }

    if (typeof patch.longitude === "number" && (patch.longitude < -180 || patch.longitude > 180)) {
      return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
    }

    const { error } = await ctx.supabase.from("pending_festivals").update(patch).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected admin API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
