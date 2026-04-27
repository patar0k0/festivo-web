import { NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeOrganizerName, pickOrganizerSlug } from "@/lib/admin/organizers";
import { transliteratedSlug } from "@/lib/text/slug";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  deleteOrganizerLogoFromStorageIfOwned,
  normalizeImageToLocalStorage,
  takeOrganizerLogoUploadRateLimit,
} from "@/lib/admin/normalizeImageToLocalStorage";

type OrganizerPayload = {
  name?: string;
  slug?: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
};

function getRequestIp(request: Request): string {
  const requestWithIp = request as Request & { ip?: string | null };
  const directIp = typeof requestWithIp.ip === "string" ? requestWithIp.ip.trim() : "";
  if (directIp) return directIp;

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const forwardedIp = forwardedFor.split(",")[0]?.trim() ?? "";
  if (forwardedIp) return forwardedIp;

  const realIp = request.headers.get("x-real-ip")?.trim() ?? "";
  if (realIp) return realIp;

  return "unknown";
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from("organizers")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as OrganizerPayload;
  const name = normalizeOrganizerName(body.name);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const requestedLogoUrl = normalizeOrganizerName(body.logo_url);
  if (requestedLogoUrl) {
    const requestIp = getRequestIp(request);
    if (takeOrganizerLogoUploadRateLimit(requestIp)) {
      return NextResponse.json({ error: "Too many logo uploads. Please try again later." }, { status: 429 });
    }
  }

  const slugBase = normalizeOrganizerName(body.slug) || transliteratedSlug(name);

  if (!slugBase) {
    return NextResponse.json({ error: "Could not generate slug" }, { status: 400 });
  }

  let adminClient: SupabaseClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/organizers][POST] Admin client initialization failed", { message });
    return NextResponse.json({ error: "Organizer creation is temporarily unavailable" }, { status: 500 });
  }

  console.info("[admin/api/organizers][POST] Using service-role client for organizer insert");

  const slug = await pickOrganizerSlug(adminClient, slugBase);

  const payload = {
    name,
    slug,
    description: normalizeOrganizerName(body.description),
    logo_url: requestedLogoUrl,
    website_url: normalizeOrganizerName(body.website_url),
    facebook_url: normalizeOrganizerName(body.facebook_url),
    instagram_url: normalizeOrganizerName(body.instagram_url),
  };

  const { data, error } = await adminClient
    .from("organizers")
    .insert(payload)
    .select("id,name,slug,logo_url")
    .single();

  if (error) {
    console.error("[admin/api/organizers][POST] Organizer insert failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info("[admin/api/organizers][POST] Organizer insert succeeded", { organizerId: data.id });

  if (data.logo_url) {
    let previousLogoUrlForStorageCleanup: string | null | undefined;
    const { data: existingOrganizer, error: existingError } = await adminClient
      .from("organizers")
      .select("logo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) {
      console.error("[admin/api/organizers][POST] Failed to read existing organizer logo before normalization", {
        organizerId: data.id,
        message: existingError.message,
      });
    } else {
      previousLogoUrlForStorageCleanup = existingOrganizer?.logo_url;
    }

    try {
      const normalizedLogoUrl = await normalizeImageToLocalStorage(data.logo_url, data.id);
      if (normalizedLogoUrl !== data.logo_url) {
        const { error: logoUpdateError } = await adminClient
          .from("organizers")
          .update({ logo_url: normalizedLogoUrl })
          .eq("id", data.id);

        if (logoUpdateError) {
          console.error("[admin/api/organizers][POST] Organizer logo URL normalization update failed", {
            organizerId: data.id,
            message: logoUpdateError.message,
          });
        } else if (previousLogoUrlForStorageCleanup && previousLogoUrlForStorageCleanup !== normalizedLogoUrl) {
          await deleteOrganizerLogoFromStorageIfOwned(
            previousLogoUrlForStorageCleanup,
            previousLogoUrlForStorageCleanup,
          );
        }
      }
    } catch (logoError) {
      const message = logoError instanceof Error ? logoError.message : "unknown";
      console.error("[admin/api/organizers][POST] Organizer logo URL normalization failed", {
        organizerId: data.id,
        message,
      });
    }
  }

  try {
    await logAdminAction({
      actor_user_id: ctx.user.id,
      action: "organizer.created",
      entity_type: "organizer",
      entity_id: data.id,
      route: "/admin/api/organizers",
      method: "POST",
      details: {
        target_name: data.name,
        target_slug: data.slug,
      },
    });
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "unknown";
    console.error("[admin/audit] organizer.created failed", { message });
  }

  return NextResponse.json({ row: { id: data.id, name: data.name, slug: data.slug } }, { status: 201 });
}
