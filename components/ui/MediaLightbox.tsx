"use client";

import { useEffect } from "react";

export type MediaItem = { type: "image"; url: string } | { type: "video"; url: string };

type Props = {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
};

function getYouTubeId(url: string): string | null {
  const match = url.match(/youtube\.com.*v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
}

export function MediaLightbox({ items, index, onClose, onChange }: Props) {
  const item = items[index];

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange((index + 1) % items.length);
      if (e.key === "ArrowLeft") onChange((index - 1 + items.length) % items.length);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, items.length, onClose, onChange]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
      {item.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- Runtime media URLs are external/user-provided.
        <img src={item.url} alt="" className="max-h-[85vh] max-w-[90vw] object-contain" />
      ) : (
        (() => {
          const id = getYouTubeId(item.url);
          if (!id) return null;

          return (
            <iframe
              className="aspect-video w-[90vw] max-w-[1000px]"
              src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Видео"
            />
          );
        })()
      )}

      <button onClick={onClose} className="absolute right-6 top-6 text-2xl text-white" aria-label="Затвори">
        ✕
      </button>

      {items.length > 1 ? (
        <>
          <button
            onClick={() => onChange((index - 1 + items.length) % items.length)}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl text-white"
            aria-label="Предишен медия елемент"
          >
            ‹
          </button>

          <button
            onClick={() => onChange((index + 1) % items.length)}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-4xl text-white"
            aria-label="Следващ медия елемент"
          >
            ›
          </button>
        </>
      ) : null}
    </div>
  );
}
