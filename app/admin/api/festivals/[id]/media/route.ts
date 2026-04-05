import { NextResponse } from "next/server";
import { rehostHeroImageIfRemote } from "@/lib/admin/rehostHeroImageFromUrl";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  fetchOrganizerPlanRow,
  getMediaLimitExceededErrorMessage,
  resolveAllowedMediaLimitsFromOrganizerPlan,
  resolveMediaPlanFromOrganizer,
} from "@/lib/admin/mediaLimits";

const HERO_IMAGES_BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function extensionFromMimeType(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/svg+xml") return "svg";
  return null;
}

function extensionFromFileName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

async function assertGalleryInsertAllowed(
  ctx: NonNullable<Awaited<ReturnType<typeof getAdminContext>>>,
  festivalId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { data: festivalRow, error: festivalFetchError } = await ctx.supabase
    .from("festivals")
    .select("organizer_id")
    .eq("id", festivalId)
    .maybeSingle<{ organizer_id: string | null }>();

  if (festivalFetchError) {
    return { ok: false, response: NextResponse.json({ error: festivalFetchError.message }, { status: 500 }) };
  }

  let organizerId: string | null = festivalRow?.organizer_id ?? null;
  if (!organizerId) {
    const { data: linkRow, error: linkError } = await ctx.supabase
      .from("festival_organizers")
      .select("organizer_id")
      .eq("festival_id", festivalId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle<{ organizer_id: string | null }>();

    if (linkError) {
      return { ok: false, response: NextResponse.json({ error: linkError.message }, { status: 500 }) };
    }
    organizerId = linkRow?.organizer_id ?? null;
  }

  const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(ctx.supabase, organizerId);

  if (orgFetchError) {
    return { ok: false, response: NextResponse.json({ error: orgFetchError.message }, { status: 500 }) };
  }

  const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
  const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

  const mediaDb = createSupabaseAdmin();

  const { count: nonHeroCount, error: nonHeroCountError } = await mediaDb
    .from("festival_media")
    .select("id", { count: "exact", head: true })
    .eq("festival_id", festivalId)
    .eq("is_hero", false);

  if (nonHeroCountError) {
    return { ok: false, response: NextResponse.json({ error: nonHeroCountError.message }, { status: 500 }) };
  }

  const currentImages = typeof nonHeroCount === "number" ? nonHeroCount : 0;
  if (currentImages >= limits.gallery) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: getMediaLimitExceededErrorMessage({ mediaType: "gallery", current: currentImages, limit: limits.gallery, plan }) },
        { status: 409 },
      ),
    };
  }

  return { ok: true };
}

async function insertGalleryRowAfterUpload(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  festivalId: string,
  publicUrl: string,
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const { data: maxRow } = await supabase
    .from("festival_media")
    .select("sort_order")
    .eq("festival_id", festivalId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

  const { data: inserted, error: insertError } = await supabase
    .from("festival_media")
    .insert({
      festival_id: festivalId,
      url: publicUrl,
      type: "image",
      sort_order: nextOrder,
      is_hero: false,
    })
    .select("id, festival_id, url, type, caption, sort_order, is_hero")
    .maybeSingle();

  if (insertError) {
    return { ok: false, response: NextResponse.json({ error: insertError.message }, { status: 500 }) };
  }

  if (!inserted) {
    return { ok: false, response: NextResponse.json({ error: "Insert failed." }, { status: 500 }) };
  }

  return { ok: true, row: inserted as Record<string, unknown> };
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data, error } = await ctx.supabase
    .from("festival_media")
    .select("id, festival_id, url, type, caption, sort_order, is_hero")
    .eq("festival_id", id)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ media: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: festivalId } = await params;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as { source_url?: unknown } | null;
      const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
      if (!sourceUrl.trim()) {
        return NextResponse.json({ error: "source_url is required." }, { status: 400 });
      }
      if (!/^https?:\/\//i.test(sourceUrl.trim())) {
        return NextResponse.json({ error: "source_url must start with http:// or https://." }, { status: 400 });
      }

      const eligibility = await assertGalleryInsertAllowed(ctx, festivalId);
      if (!eligibility.ok) {
        return eligibility.response;
      }

      const supabaseAdmin = createSupabaseAdmin();
      const timestamp = Date.now();
      const outcome = await rehostHeroImageIfRemote(supabaseAdmin, sourceUrl, (ext) =>
        `festival-hero/gallery/festival-${festivalId}-${timestamp}.${ext}`,
      );

      if (!outcome.ok) {
        return NextResponse.json({ error: outcome.error }, { status: 422 });
      }

      const inserted = await insertGalleryRowAfterUpload(supabaseAdmin, festivalId, outcome.publicUrl);
      if (!inserted.ok) {
        return inserted.response;
      }

      return NextResponse.json({ ok: true, row: inserted.row });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!file.type || !file.type.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are allowed." }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Image file is empty." }, { status: 400 });
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Image file is too large. Maximum size is ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB.` },
        { status: 400 },
      );
    }

    const extension = extensionFromMimeType(file.type) ?? extensionFromFileName(file.name) ?? "bin";
    const timestamp = Date.now();
    const objectPath = `festival-hero/gallery/festival-${festivalId}-${timestamp}.${extension}`;

    const eligibility = await assertGalleryInsertAllowed(ctx, festivalId);
    if (!eligibility.ok) {
      return eligibility.response;
    }

    const supabaseAdmin = createSupabaseAdmin();
    const imageBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).upload(objectPath, imageBuffer, {
      upsert: false,
      contentType: file.type,
      cacheControl: "3600",
    });

    if (uploadError) {
      return NextResponse.json({ error: `Image upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicData } = supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(objectPath);
    const publicUrl = publicData?.publicUrl ?? null;

    if (!publicUrl) {
      return NextResponse.json({ error: "Uploaded image URL is unavailable." }, { status: 500 });
    }

    const inserted = await insertGalleryRowAfterUpload(supabaseAdmin, festivalId, publicUrl);
    if (!inserted.ok) {
      return inserted.response;
    }

    return NextResponse.json({ ok: true, row: inserted.row });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
