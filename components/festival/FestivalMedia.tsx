"use client";

import { useState } from "react";

import { MediaLightbox, type MediaItem } from "@/components/ui/MediaLightbox";
import { getEmbedUrl, getYouTubeVideoId } from "@/lib/media/getEmbedUrl";

type Props = {
  items: MediaItem[];
};

function VideoThumb({ url, compact }: { url: string; compact?: boolean }) {
  const playOverlay = compact ? (
    <div className="absolute inset-0 flex items-center justify-center text-xs text-white">▶</div>
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl">▶</div>
    </div>
  );
  const ytId = getYouTubeVideoId(url);
  if (ytId) {
    const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail is external runtime URL. */}
        <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/30 transition group-hover:bg-black/40" />
        {playOverlay}
      </>
    );
  }
  if (getEmbedUrl(url)) {
    return (
      <>
        <div className="h-full w-full bg-neutral-900" />
        <div className="absolute inset-0 bg-black/30 transition group-hover:bg-black/40" />
        {playOverlay}
      </>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-xs text-white/80">Видео</div>
  );
}

export function FestivalMedia({ items }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!items || items.length === 0) return null;

  const active = items[activeIndex];

  return (
    <div className="mt-3">
      <div
        className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-xl"
        onClick={() => setLightboxIndex(activeIndex)}
      >
        {active.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- Runtime media URLs are external/user-provided.
          <img src={active.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="relative h-full w-full">
            <VideoThumb url={active.url} />
          </div>
        )}

        {items.length > 1 ? (
          <div className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
            {activeIndex + 1} / {items.length}
          </div>
        ) : null}
      </div>

      {items.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {items.map((item, i) => {
            if (item.type === "image") {
              return (
                <button
                  key={item.url}
                  onClick={() => setActiveIndex(i)}
                  className="h-14 w-20 overflow-hidden rounded-md"
                  aria-label={`Превю ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- Runtime media URLs are external/user-provided. */}
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                </button>
              );
            }

            return (
              <button
                key={item.url}
                onClick={() => setActiveIndex(i)}
                className="group relative h-14 w-20 overflow-hidden rounded-md"
                aria-label={`Видео превю ${i + 1}`}
              >
                <VideoThumb url={item.url} compact />
              </button>
            );
          })}
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <MediaLightbox
          items={items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={(i) => setLightboxIndex(i)}
        />
      ) : null}
    </div>
  );
}
