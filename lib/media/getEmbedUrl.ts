/**
 * YouTube video id from watch / youtu.be URLs (only when host looks like YouTube).
 */
export function getYouTubeVideoId(url: string): string | null {
  if (!url.includes("youtube.com") && !url.includes("youtu.be")) return null;
  const match =
    url.match(/[?&]v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?/#]+)/) ||
    (url.includes("youtube.com") ? url.match(/\/shorts\/([^?/#]+)/) : null);
  const id = match?.[1]?.trim();
  return id || null;
}

/**
 * Returns true if the URL is a Facebook video link.
 * Facebook iframe embeds require Meta App Review — use a link card instead.
 */
export function isFacebookVideoUrl(url: string): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host === "fb.watch" || host.endsWith("facebook.com");
  } catch {
    return false;
  }
}

/**
 * iframe src for YouTube videos only.
 * Facebook videos are not embedded via iframe — use isFacebookVideoUrl() + a link card.
 */
export function getEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();

  if (u.includes("youtube.com") || u.includes("youtu.be")) {
    const id = getYouTubeVideoId(u);
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}`;
  }

  return null;
}
