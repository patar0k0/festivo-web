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

    const { data: maxRow } = await ctx.supabase
      .from("festival_media")
      .select("sort_order")
      .eq("festival_id", festivalId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

    const { data: inserted, error: insertError } = await ctx.supabase
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
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (!inserted) {
      return NextResponse.json({ error: "Insert failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, row: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
