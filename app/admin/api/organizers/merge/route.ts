import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type MergePayload = {
  source_id?: string;
  target_id?: string;
};

type OrganizerMergeRow = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
  city_id: number | null;
  is_active: boolean | null;
};

function normalizeId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as MergePayload;
  const sourceId = normalizeId(body.source_id);
  const targetId = normalizeId(body.target_id);

  if (!sourceId || !targetId) {
    return NextResponse.json({ error: "source_id and target_id are required" }, { status: 400 });
  }

  if (sourceId === targetId) {
    return NextResponse.json({ error: "source_id and target_id must be different" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/api/organizers/merge] Admin client initialization failed", { message });
    return NextResponse.json({ error: "Organizer merge is temporarily unavailable" }, { status: 500 });
  }

  const { data: source, error: sourceError } = await adminClient
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,email,phone,city_id,is_active")
    .eq("id", sourceId)
    .eq("is_active", true)
    .maybeSingle<OrganizerMergeRow>();

  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
  if (!source) return NextResponse.json({ error: "Source organizer not found or already inactive" }, { status: 404 });

  const { data: target, error: targetError } = await adminClient
    .from("organizers")
    .select("id,name,slug,description,logo_url,website_url,facebook_url,instagram_url,email,phone,city_id,is_active")
    .eq("id", targetId)
    .eq("is_active", true)
    .maybeSingle<OrganizerMergeRow>();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "Target organizer not found or inactive" }, { status: 404 });

  const targetPatch: Record<string, string | number | null> = {};

  if (!hasText(target.description) && hasText(source.description)) targetPatch.description = source.description;
  if (!hasText(target.logo_url) && hasText(source.logo_url)) targetPatch.logo_url = source.logo_url;
  if (!hasText(target.website_url) && hasText(source.website_url)) targetPatch.website_url = source.website_url;
  if (!hasText(target.facebook_url) && hasText(source.facebook_url)) targetPatch.facebook_url = source.facebook_url;
  if (!hasText(target.instagram_url) && hasText(source.instagram_url)) targetPatch.instagram_url = source.instagram_url;
  if (!hasText(target.email) && hasText(source.email)) targetPatch.email = source.email;
  if (!hasText(target.phone) && hasText(source.phone)) targetPatch.phone = source.phone;
  if (target.city_id == null && source.city_id != null) targetPatch.city_id = source.city_id;

  if (Object.keys(targetPatch).length > 0) {
    const { error: updateTargetError } = await adminClient.from("organizers").update(targetPatch).eq("id", targetId);
    if (updateTargetError) return NextResponse.json({ error: updateTargetError.message }, { status: 500 });
  }


  const { data: targetFestivalLinks, error: targetFestivalLinksError } = await adminClient
    .from("festival_organizers")
    .select("festival_id")
    .eq("organizer_id", targetId)
    .returns<Array<{ festival_id: string }>>();

  if (targetFestivalLinksError) return NextResponse.json({ error: targetFestivalLinksError.message }, { status: 500 });

  const targetFestivalIds = (targetFestivalLinks ?? []).map((row) => row.festival_id).filter(Boolean);

  if (targetFestivalIds.length > 0) {
    const { error: dedupeFestivalOrganizerLinksError } = await adminClient
      .from("festival_organizers")
      .delete()
      .eq("organizer_id", sourceId)
      .in("festival_id", targetFestivalIds);

    if (dedupeFestivalOrganizerLinksError) return NextResponse.json({ error: dedupeFestivalOrganizerLinksError.message }, { status: 500 });
  }

  const { error: festivalOrganizerMoveError } = await adminClient
    .from("festival_organizers")
    .update({ organizer_id: targetId })
    .eq("organizer_id", sourceId);

  if (festivalOrganizerMoveError) return NextResponse.json({ error: festivalOrganizerMoveError.message }, { status: 500 });

  const { error: festivalMoveError } = await adminClient.from("festivals").update({ organizer_id: targetId }).eq("organizer_id", sourceId);
  if (festivalMoveError) return NextResponse.json({ error: festivalMoveError.message }, { status: 500 });

  const { error: pendingFestivalMoveError } = await adminClient.from("pending_festivals").update({ organizer_id: targetId }).eq("organizer_id", sourceId);
  if (pendingFestivalMoveError) return NextResponse.json({ error: pendingFestivalMoveError.message }, { status: 500 });

  const { error: sourceDeactivateError } = await adminClient
    .from("organizers")
    .update({ is_active: false, merged_into: targetId })
    .eq("id", sourceId)
    .eq("is_active", true);

  if (sourceDeactivateError) return NextResponse.json({ error: sourceDeactivateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, source_id: sourceId, target_id: targetId });
}
