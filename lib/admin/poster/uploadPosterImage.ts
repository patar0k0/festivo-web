import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHeroImagesBucketName } from "@/lib/admin/rehostHeroImageFromUrl";
import { STORAGE_UPLOAD_CACHE_CONTROL } from "@/lib/storage/cacheControl";

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  return "jpg";
}

/** Uploads a poster buffer to the hero bucket and returns its public URL. */
export async function uploadPosterImage(
  supabase: SupabaseClient,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const bucket = getHeroImagesBucketName();
  const ext = extFromMime(mimeType);
  const objectPath = `telegram-poster/${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    upsert: false,
    contentType: mimeType.split(";")[0]?.trim() || `image/${ext}`,
    cacheControl: STORAGE_UPLOAD_CACHE_CONTROL,
  });
  if (error) throw new Error(`Poster upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (!data?.publicUrl) throw new Error("Could not get public URL for poster");
  return data.publicUrl;
}
