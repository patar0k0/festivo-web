import { NextResponse } from "next/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { transliteratedSlug } from "@/lib/text/slug";

type OrganizerPayload = {
  name?: string;
  slug?: string;
  description?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
};


async function pickOrganizerSlug(client: SupabaseClient, baseSlug: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const { data, error } = await client.from("organizers").select("id").eq("slug", candidate).maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return candidate;
    }
  }

  throw new Error("Failed to generate unique organizer slug");
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function GET() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await ctx.supabase
    .from("organizers")
    .select("id,name,slug")
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
  const name = normalizeText(body.name);

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const generatedSlug = transliteratedSlug(name);
  const slugBase = normalizeText(body.slug) || generatedSlug;

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
    description: normalizeText(body.description),
    logo_url: normalizeText(body.logo_url),
    website_url: normalizeText(body.website_url),
    facebook_url: normalizeText(body.facebook_url),
    instagram_url: normalizeText(body.instagram_url),
  };

  const { data, error } = await adminClient
    .from("organizers")
    .insert(payload)
    .select("id,name,slug")
    .single();

  if (error) {
    console.error("[admin/api/organizers][POST] Organizer insert failed", { message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info("[admin/api/organizers][POST] Organizer insert succeeded", { organizerId: data.id });

  return NextResponse.json({ row: data }, { status: 201 });
}
