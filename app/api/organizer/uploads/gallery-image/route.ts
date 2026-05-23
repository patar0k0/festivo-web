import { NextResponse } from "next/server";
import { getPortalAdminClient, getPortalSessionUser } from "@/lib/organizer/portal";
import { STORAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage/cacheControl";

export const dynamic = "force-dynamic";

const HERO_IMAGES_BUCKET = process.env.SUPABASE_HERO_IMAGES_BUCKET || "festival-hero-images";
const MAX_GALLERY_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image

function extensionFromMimeType(mimeType: string): string | null {
  const normalized = mimeType.toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/avif") return "avif";
  return null;
}

function extensionFromFileName(name: string): string | null {
  const match = name.toLowerCase().match(/\.(jpe?g|png|webp|gif|avif)$/);
  return match?.[1].replace("jpeg", "jpg") ?? null;
}

/**
 * Gallery upload — accepts ONE file per request (the client uploads
 * sequentially). Returns a single public URL the client appends to its
 * working gallery list. We reuse the festival-hero-images bucket (one
 * bucket for festival images of all kinds keeps RLS + CDN config simple).
 */
export async function POST(request: Request) {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Необходим е вход." }, { status: 401 });
  }

  let admin;
  try {
    admin = getPortalAdminClient();
  } catch {
    return NextResponse.json({ error: "Услугата е временно недостъпна." }, { status: 503 });
  }

  const { data: membershipRow, error: membershipErr } = await admin
    .from("organizer_members")
    .select("user_id")
    .eq("user_id", session.user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (membershipErr || !membershipRow) {
    return NextResponse.json({ error: "Нямате активен организаторски профил." }, { status: 403 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Невалидно тяло на заявката." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Не е изпратен файл." }, { status: 400 });
  }

  if (!file.type || !file.type.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Разрешени са само изображения." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Файлът е празен." }, { status: 400 });
  }

  if (file.size > MAX_GALLERY_IMAGE_BYTES) {
    return NextResponse.json(
      {
        error: `Файлът е твърде голям. Максимум ${Math.floor(MAX_GALLERY_IMAGE_BYTES / (1024 * 1024))} MB.`,
      },
      { status: 400 },
    );
  }

  const extension =
    extensionFromMimeType(file.type) ?? extensionFromFileName(file.name) ?? "jpg";
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const objectPath = `festival-gallery/organizer/${session.user.id}-${timestamp}-${rand}.${extension}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(HERO_IMAGES_BUCKET)
    .upload(objectPath, buffer, {
      upsert: false,
      contentType: file.type,
      cacheControl: STORAGE_UPLOAD_CACHE_CONTROL,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Качването не успя: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: publicData } = admin.storage.from(HERO_IMAGES_BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicData?.publicUrl ?? null;

  if (!publicUrl) {
    return NextResponse.json(
      { error: "URL на каченото изображение не е достъпен." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
