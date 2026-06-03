import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractHeroStorageObjectPathFromOurPublicUrl,
  getHeroImagesBucketName,
} from "@/lib/admin/rehostHeroImageFromUrl";

// NOTE: detection logic is mirrored (standalone, no TS imports) in
// scripts/cleanup-orphan-hero-images.mjs — keep both in sync.

export type OrphanObject = {
  path: string; // bucket-relative, e.g. "research-ai/123-abc.jpg"
  folder: string; // first path segment
  sizeBytes: number;
  uploadedAt: string | null;
};

const PAGE = 1000;

function addPath(set: Set<string>, url: unknown): void {
  if (typeof url !== "string" || !url.trim()) return;
  const p = extractHeroStorageObjectPathFromOurPublicUrl(url);
  if (p) set.add(p);
}

/** Every bucket-relative hero path referenced by any DB row. */
export async function collectReferencedHeroPaths(supabase: SupabaseClient): Promise<Set<string>> {
  const refs = new Set<string>();

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("festivals")
      .select("hero_image, image_url")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`festivals: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ hero_image: unknown; image_url: unknown }>) {
      addPath(refs, r.hero_image);
      addPath(refs, r.image_url);
    }
    if (data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("pending_festivals")
      .select("hero_image, gallery_image_urls")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`pending_festivals: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ hero_image: unknown; gallery_image_urls: unknown }>) {
      addPath(refs, r.hero_image);
      if (Array.isArray(r.gallery_image_urls)) {
        for (const g of r.gallery_image_urls) addPath(refs, g);
      }
    }
    if (data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("festival_media")
      .select("url")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`festival_media: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ url: unknown }>) addPath(refs, r.url);
    if (data.length < PAGE) break;
  }

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("organizers")
      .select("logo_url")
      .range(offset, offset + PAGE - 1);
    if (error) throw new Error(`organizers: ${error.message}`);
    if (!data?.length) break;
    for (const r of data as Array<{ logo_url: unknown }>) addPath(refs, r.logo_url);
    if (data.length < PAGE) break;
  }

  return refs;
}

export { getHeroImagesBucketName };

/** Recursively list every object in the hero bucket (Storage list is per-prefix, max 1000). */
export async function listAllHeroObjects(supabase: SupabaseClient, prefix = ""): Promise<OrphanObject[]> {
  const bucket = getHeroImagesBucketName();
  const out: OrphanObject[] = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have null id/metadata; recurse.
      if (entry.id === null || entry.metadata == null) {
        const nested = await listAllHeroObjects(supabase, full);
        out.push(...nested);
      } else {
        out.push({
          path: full,
          folder: full.split("/")[0] ?? "",
          sizeBytes: Number((entry.metadata as { size?: unknown })?.size ?? 0),
          uploadedAt: entry.created_at ?? null,
        });
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

/** Objects in the bucket not referenced by any DB row. `minAgeMs` excludes too-new uploads. */
export async function findHeroOrphans(
  supabase: SupabaseClient,
  opts: { minAgeMs?: number } = {},
): Promise<OrphanObject[]> {
  const minAgeMs = opts.minAgeMs ?? 0;
  const cutoff = minAgeMs > 0 ? Date.now() - minAgeMs : null;

  const [referenced, objects] = await Promise.all([
    collectReferencedHeroPaths(supabase),
    listAllHeroObjects(supabase),
  ]);

  return objects.filter((o) => {
    if (referenced.has(o.path)) return false;
    if (cutoff !== null) {
      const ts = o.uploadedAt ? Date.parse(o.uploadedAt) : 0;
      if (ts && ts > cutoff) return false; // too new — may not be wired into DB yet
    }
    return true;
  });
}

/**
 * True when `publicUrl` is still referenced by any DB row. Targeted (per-URL)
 * existence checks — cheap enough for inline cleanup at delete time.
 * Returns true on any query error (fail-safe: do not delete if unsure).
 */
export async function isHeroUrlReferencedAnywhere(supabase: SupabaseClient, publicUrl: string): Promise<boolean> {
  const url = publicUrl.trim();
  if (!url) return false;

  const head = { count: "exact" as const, head: true };

  const results = await Promise.all([
    supabase.from("festivals").select("id", head).or(`hero_image.eq.${url},image_url.eq.${url}`),
    supabase.from("pending_festivals").select("id", head).eq("hero_image", url),
    supabase.from("festival_media").select("id", head).eq("url", url),
    supabase.from("organizers").select("id", head).eq("logo_url", url),
    // jsonb array containment: gallery_image_urls @> ["<url>"]
    supabase.from("pending_festivals").select("id", head).contains("gallery_image_urls", [url]),
  ]);

  for (const r of results) {
    if (r.error) return true; // fail-safe
    if ((r.count ?? 0) > 0) return true;
  }
  return false;
}
