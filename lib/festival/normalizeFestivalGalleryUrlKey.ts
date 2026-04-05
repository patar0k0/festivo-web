/**
 * Stable key for deduplicating gallery image URLs (hero vs festival_media, trailing slash, http/https, hash).
 * Display should still use the original trimmed URL from the source row.
 */
export function normalizeFestivalGalleryUrlKey(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    url.hash = "";
    if (url.protocol === "http:") url.protocol = "https:";
    const host = url.hostname.toLowerCase().replace(/^www\./i, "");
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep encoded path
    }
    const port =
      url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
    return `https://${host}${port}${path}${url.search}`;
  } catch {
    return trimmed.toLowerCase();
  }
}
