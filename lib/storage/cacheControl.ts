/**
 * Cache-Control header applied to every object we upload to Supabase Storage.
 *
 * Festivo's object paths are content-addressed: every upload generates a fresh
 * UUID-suffixed filename (see `normalizeImageToLocalStorage`, the admin hero /
 * gallery upload routes, the avatar route). When a user replaces an image,
 * the *URL* changes — the old URL is never reused with new bytes. That makes
 * `immutable` semantically correct: any client / CDN / Vercel image optimizer
 * can hold the response for the full `max-age` window without revalidation.
 *
 * Why this matters:
 *   - Repeat visitors stop re-downloading ~1 MB of festival imagery per visit.
 *   - Vercel's image optimizer keys its 31-day cache by the upstream
 *     `Cache-Control`; a longer TTL upstream means fewer source-image
 *     transformations counted against the Hobby plan quota.
 *   - Lighthouse `cache-insight` audit stops flagging Festivo storage URLs.
 *
 * Supabase's storage API defaults to `max-age=3600` (1h) when this option is
 * omitted, which is far too aggressive for content-addressed assets.
 */
export const STORAGE_UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";
