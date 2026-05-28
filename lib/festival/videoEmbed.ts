/**
 * Returns true if the URL is a Facebook or fb.watch video link.
 * Facebook iframe embeds require Meta App Review — use a link card instead.
 */
export function isFacebookVideoUrl(pageUrl: string): boolean {
  const raw = pageUrl.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "fb.watch" || host.endsWith("facebook.com");
  } catch {
    return false;
  }
}

/**
 * Build an iframe embed URL for YouTube URLs only.
 * Facebook videos are not embedded via iframe — use isFacebookVideoUrl() + link card instead.
 * Returns null if the URL is not embeddable.
 */
export function getVideoEmbedSrcFromPageUrl(pageUrl: string): string | null {
  const raw = pageUrl.trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      const path = u.pathname.toLowerCase();
      if (path.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        if (id && /^[a-zA-Z0-9_-]{6,}$/.test(id)) {
          return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
        }
      }
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{6,}$/.test(v)) {
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}`;
      }
      const embedMatch = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
      if (embedMatch?.[1]) {
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(embedMatch[1])}`;
      }
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

export function isSupportedVideoPageUrl(pageUrl: string): boolean {
  return isFacebookVideoUrl(pageUrl) || getVideoEmbedSrcFromPageUrl(pageUrl) !== null;
}
