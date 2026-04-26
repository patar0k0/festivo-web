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
 * iframe src for supported video hosts (Facebook Reels/watch, YouTube).
 */
export function getEmbedUrl(url: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();

  if (u.includes("facebook.com")) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u)}`;
  }

  if (u.includes("youtube.com") || u.includes("youtu.be")) {
    const id = getYouTubeVideoId(u);
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}`;
  }

  return null;
}
