const SUPABASE_OBJECT_SEGMENT = "/storage/v1/object/public/";
const SUPABASE_RENDER_SEGMENT = "/storage/v1/render/image/public/";

/**
 * Converts a Supabase storage object URL to a Transform (render/image) URL so
 * the image is served from Supabase's Cloudflare CDN instead of going through
 * Vercel's image optimizer. Eliminates cold-cache encoding overhead for LCP images.
 *
 * Returns null when the URL is not a Supabase storage URL for this project
 * (external CDN links such as fbcdn.net are left untouched).
 */
export function toSupabaseTransformUrl(
  src: string,
  opts: { width: number; height?: number; quality?: number },
): string | null {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseOrigin || !src.startsWith(supabaseOrigin)) return null;

  const idx = src.indexOf(SUPABASE_OBJECT_SEGMENT);
  if (idx === -1) return null;

  let bucketAndPath = src.slice(idx + SUPABASE_OBJECT_SEGMENT.length);
  // Drop any existing query string (e.g. cache-bust / `_festivo_*_retry` params);
  // the render endpoint carries its own params and a stray `?` would corrupt them.
  const queryIdx = bucketAndPath.indexOf("?");
  if (queryIdx !== -1) bucketAndPath = bucketAndPath.slice(0, queryIdx);
  const params = new URLSearchParams({
    width: String(opts.width),
    quality: String(opts.quality ?? 80),
    resize: "cover",
    format: "webp",
  });
  if (opts.height) params.set("height", String(opts.height));

  return `${supabaseOrigin}${SUPABASE_RENDER_SEGMENT}${bucketAndPath}?${params.toString()}`;
}
