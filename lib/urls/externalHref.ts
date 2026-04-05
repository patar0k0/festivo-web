/**
 * Normalize user-entered website/social URLs for safe use in `href`.
 * Plain hostnames (e.g. example.bg) become https://…; relative paths are rejected.
 */
export function normalizeExternalHttpHref(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") return null;
    try {
      return new URL(trimmed).href;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("//")) {
    try {
      return new URL(`https:${trimmed}`).href;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/") || trimmed.startsWith(".") || trimmed.startsWith("?") || trimmed.startsWith("#")) {
    return null;
  }

  try {
    const u = new URL(`https://${trimmed}`);
    if (!u.hostname) return null;
    return u.href;
  } catch {
    return null;
  }
}
