/**
 * Build an iframe embed URL for YouTube or Facebook watch URLs.
 * Returns null if the URL is not a supported public video page.
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

    if (host === "fb.watch" || host.endsWith("facebook.com")) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(raw)}&show_text=false&width=1280`;
    }

    return null;
  } catch {
    return null;
  }
}

export function isSupportedVideoPageUrl(pageUrl: string): boolean {
  return getVideoEmbedSrcFromPageUrl(pageUrl) !== null;
}
