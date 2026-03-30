import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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

    const { data: row, error: fetchError } = await ctx.supabase
      .from("pending_festivals")
      .select("gallery_image_urls")
      .eq("id", pendingId)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json({ error: fetchError?.message ?? "Pending festival not found." }, { status: fetchError ? 500 : 404 });
    }

    const next = [...asStringArray(row.gallery_image_urls), publicUrl];

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
      .maybeSingle();

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
