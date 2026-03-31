import type { SupabaseClient } from "@supabase/supabase-js";
import { extractHeroStorageObjectPathFromOurPublicUrl, getHeroImagesBucketName } from "@/lib/admin/rehostHeroImageFromUrl";

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
