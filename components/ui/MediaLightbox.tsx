"use client";

import { useEffect } from "react";

import { getEmbedUrl, isFacebookVideoUrl } from "@/lib/media/getEmbedUrl";

export type MediaItem = { type: "image"; url: string } | { type: "video"; url: string };

type Props = {
  items: MediaItem[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
};

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
          if (isFacebookVideoUrl(item.url)) {
            return (
              <div className="flex flex-col items-center justify-center gap-5 p-8 text-center">
                <svg viewBox="0 0 24 24" fill="#1877f2" className="h-14 w-14">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                <p className="text-lg font-semibold text-white">Facebook видео</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#1877f2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#166fe5]"
                >
                  Гледай във Facebook ↗
                </a>
              </div>
            );
          }
          const embed = getEmbedUrl(item.url);
          if (!embed) {
            return (
              <div className="flex h-full w-full items-center justify-center bg-black text-white">
                Unsupported video
              </div>
            );
          }
          const iframeSrc = `${embed}${embed.includes("?") ? "&" : "?"}autoplay=1&rel=0`;
          return (
            <div className="flex h-full w-full items-center justify-center bg-black">
              {/* h-[80vh] + aspect-video keeps correct 16:9 ratio; max-w-[90vw] prevents overflow on narrow screens */}
              <div className="aspect-video h-[80vh] max-w-[90vw]">
                <iframe
                  src={iframeSrc}
                  className="h-full w-full"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title="Видео"
                  style={{ border: "none", overflow: "hidden" }}
                />
              </div>
            </div>
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
