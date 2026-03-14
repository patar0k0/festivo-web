import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const HERO_IMAGES_BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";
const MAX_HERO_IMAGE_BYTES = 8 * 1024 * 1024;

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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

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

    if (file.size > MAX_HERO_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Image file is too large. Maximum size is ${Math.floor(MAX_HERO_IMAGE_BYTES / (1024 * 1024))}MB.` },
        { status: 400 },
      );
    }

    const extension = extensionFromMimeType(file.type) ?? extensionFromFileName(file.name) ?? "bin";
    const timestamp = Date.now();
    const objectPath = `festival-hero/manual/${id}-${timestamp}.${extension}`;

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

    const { data: updatedRow, error: updateError } = await ctx.supabase
      .from("pending_festivals")
      .update({
        hero_image: publicUrl,
        hero_image_source: "manual_upload",
      })
      .eq("id", id)
      .select("id, hero_image, hero_image_source")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: `Failed to update pending festival hero image: ${updateError.message}` }, { status: 500 });
    }

    if (!updatedRow) {
      return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      hero_image: updatedRow.hero_image,
      hero_image_source: updatedRow.hero_image_source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected hero image upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const { data, error } = await ctx.supabase
      .from("pending_festivals")
      .update({
        hero_image: null,
        hero_image_source: null,
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Failed to remove hero image: ${error.message}` }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Pending festival not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected hero image remove error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
