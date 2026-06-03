import type { SupabaseClient } from "@supabase/supabase-js";
import { extractHeroStorageObjectPathFromOurPublicUrl, getHeroImagesBucketName } from "@/lib/admin/rehostHeroImageFromUrl";
import { isHeroUrlReferencedAnywhere } from "@/lib/admin/storageGc";

function isBenignStorageRemoveError(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  const m = error.message.toLowerCase();
  return (
    m.includes("not found") ||
    m.includes("does not exist") ||
    m.includes("no such file") ||
    m.includes("404") ||
    m.includes("object not found")
  );
}

/**
 * Deletes the Storage object when `publicUrl` points at our festival hero bucket
 * public URL; no-ops for external URLs. Treats missing objects as success so DB
 * cleanup can proceed. Returns failure only when Storage reports a non-recoverable error.
 */
/**
 * Like {@link removeHeroStorageObjectForPublicUrlIfApplicable}, but first checks
 * the URL is no longer referenced by any DB row. Call AFTER the row that held the
 * reference has been updated/deleted, so the just-removed reference is already gone.
 */
export async function removeHeroStorageObjectIfUnreferenced(
  supabase: SupabaseClient,
  publicUrl: string,
): Promise<{ ok: true; deleted: boolean } | { ok: false; message: string }> {
  const stillReferenced = await isHeroUrlReferencedAnywhere(supabase, publicUrl);
  if (stillReferenced) {
    return { ok: true, deleted: false };
  }
  const result = await removeHeroStorageObjectForPublicUrlIfApplicable(supabase, publicUrl);
  if (!result.ok) return result;
  return { ok: true, deleted: true };
}

export async function removeHeroStorageObjectForPublicUrlIfApplicable(
  supabase: SupabaseClient,
  publicUrl: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const objectPath = extractHeroStorageObjectPathFromOurPublicUrl(publicUrl);
  if (!objectPath) {
    return { ok: true };
  }
  const bucket = getHeroImagesBucketName();
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error && !isBenignStorageRemoveError(error)) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
