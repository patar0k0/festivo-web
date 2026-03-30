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
import { pendingRowToOrganizerEntries, type PendingOrganizerRowFields } from "@/lib/admin/pendingOrganizerEntries";

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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: pendingId } = await params;
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

      const { data: pendingRow, error: pendingFetchError } = await ctx.supabase
        .from("pending_festivals")
        .select("organizer_id,organizer_entries,organizer_name,gallery_image_urls")
        .eq("id", pendingId)
        .maybeSingle<{
          organizer_id: string | null;
          organizer_entries: unknown;
          organizer_name: string | null;
          gallery_image_urls: unknown;
        }>();

      if (pendingFetchError) {
        return NextResponse.json({ error: pendingFetchError.message }, { status: 500 });
      }

      if (!pendingRow) {
        return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
      }

      const currentGallery = asStringArray(pendingRow.gallery_image_urls);

      const rowForEntries: PendingOrganizerRowFields = {
        organizer_entries: pendingRow.organizer_entries,
        organizer_id: pendingRow.organizer_id,
        organizer_name: pendingRow.organizer_name,
      };
      const organizerEntries = pendingRowToOrganizerEntries(rowForEntries);
      const primaryOrganizerId = pendingRow.organizer_id ?? organizerEntries[0]?.organizer_id ?? null;

      const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(ctx.supabase, primaryOrganizerId);

      if (orgFetchError) {
        return NextResponse.json({ error: orgFetchError.message }, { status: 500 });
      }

      const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
      const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

      if (currentGallery.length >= limits.gallery) {
        return NextResponse.json(
          { error: getMediaLimitExceededErrorMessage({ mediaType: "gallery", current: currentGallery.length, limit: limits.gallery, plan }) },
          { status: 409 },
        );
      }

      const supabaseAdmin = createSupabaseAdmin();
      const timestamp = Date.now();
      const outcome = await rehostHeroImageIfRemote(supabaseAdmin, sourceUrl, (ext) =>
        `festival-hero/pending-gallery/${pendingId}-${timestamp}.${ext}`,
      );

      if (!outcome.ok) {
        return NextResponse.json({ error: outcome.error }, { status: 422 });
      }

      const publicUrl = outcome.publicUrl;
      const next = [...currentGallery, publicUrl];

      const { error: updateError } = await ctx.supabase
        .from("pending_festivals")
        .update({ gallery_image_urls: next })
        .eq("id", pendingId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, url: publicUrl, gallery_image_urls: next });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!file.type || !file.type.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Only image uploads are allowed." }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Invalid image file." }, { status: 400 });
    }

    const extension = extensionFromMimeType(file.type) ?? extensionFromFileName(file.name) ?? "bin";
    const timestamp = Date.now();
    const objectPath = `festival-hero/pending-gallery/${pendingId}-${timestamp}.${extension}`;

    // Enforce plan-based media limits before uploading anything to storage.
    const { data: pendingRow, error: pendingFetchError } = await ctx.supabase
      .from("pending_festivals")
      .select("organizer_id,organizer_entries,organizer_name,gallery_image_urls")
      .eq("id", pendingId)
      .maybeSingle<{
        organizer_id: string | null;
        organizer_entries: unknown;
        organizer_name: string | null;
        gallery_image_urls: unknown;
      }>();

    if (pendingFetchError) {
      return NextResponse.json({ error: pendingFetchError.message }, { status: 500 });
    }

    if (!pendingRow) {
      return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
    }

    const currentGallery = asStringArray(pendingRow.gallery_image_urls);

    const rowForEntries: PendingOrganizerRowFields = {
      organizer_entries: pendingRow.organizer_entries,
      organizer_id: pendingRow.organizer_id,
      organizer_name: pendingRow.organizer_name,
    };
    const organizerEntries = pendingRowToOrganizerEntries(rowForEntries);
    const primaryOrganizerId = pendingRow.organizer_id ?? organizerEntries[0]?.organizer_id ?? null;

    const { data: organizerPlanRow, error: orgFetchError } = await fetchOrganizerPlanRow(ctx.supabase, primaryOrganizerId);

    if (orgFetchError) {
      return NextResponse.json({ error: orgFetchError.message }, { status: 500 });
    }

    const plan = resolveMediaPlanFromOrganizer(organizerPlanRow);
    const limits = resolveAllowedMediaLimitsFromOrganizerPlan(organizerPlanRow);

    if (currentGallery.length >= limits.gallery) {
      return NextResponse.json(
        { error: getMediaLimitExceededErrorMessage({ mediaType: "gallery", current: currentGallery.length, limit: limits.gallery, plan }) },
        { status: 409 },
      );
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

    const next = [...currentGallery, publicUrl];

    const { error: updateError } = await ctx.supabase
      .from("pending_festivals")
      .update({ gallery_image_urls: next })
      .eq("id", pendingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, url: publicUrl, gallery_image_urls: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id: pendingId } = await params;
    const url = new URL(request.url).searchParams.get("url")?.trim() ?? "";

    if (!url) {
      return NextResponse.json({ error: "url query parameter is required." }, { status: 400 });
    }

    const { data: row, error: fetchError } = await ctx.supabase
      .from("pending_festivals")
      .select("gallery_image_urls")
      .eq("id", pendingId)
      .maybeSingle<{ gallery_image_urls: unknown }>();

    if (fetchError || !row) {
      return NextResponse.json({ error: fetchError?.message ?? "Pending festival not found." }, { status: fetchError ? 500 : 404 });
    }

    const filtered = asStringArray(row.gallery_image_urls).filter((u) => u !== url);

    const { error: updateError } = await ctx.supabase
      .from("pending_festivals")
      .update({ gallery_image_urls: filtered })
      .eq("id", pendingId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, gallery_image_urls: filtered });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
