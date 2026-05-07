export async function shareEvent({
  title,
  text,
  url,
}: {
  title: string;
  text?: string;
  url: string;
}) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      if (url.includes("preview")) return false;

      if (navigator.canShare && !navigator.canShare({ title, text, url })) {
        return false;
      }

      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function getShareLinks({ title, url }: { title: string; url: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);

  return {
    copy: url,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    email: `mailto:?subject=${t}&body=${u}`,
  };
}
