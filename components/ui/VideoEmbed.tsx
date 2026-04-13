"use client";

import { useState } from "react";

type Props = {
  url: string;
};

function getYouTubeId(url: string): string | null {
  const match = url.match(/youtube\.com.*v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
}

export function VideoEmbed({ url }: Props) {
  const [playing, setPlaying] = useState(false);
  const videoId = getYouTubeId(url);

  if (!videoId) return null;

  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <div className="mt-3">
      <div className="relative h-[220px] w-full overflow-hidden rounded-xl md:h-[260px]">
        {!playing ? (
          <button type="button" onClick={() => setPlaying(true)} className="group relative h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- YouTube thumbnail is external runtime URL. */}
            <img src={thumbnail} alt="Видео преглед" className="h-full w-full object-cover" />

            <div className="absolute inset-0 bg-black/30 transition group-hover:bg-black/40" />

            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-xl text-black">▶</div>
            </div>
          </button>
        ) : (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            title="Видео"
          />
        )}
      </div>
    </div>
  );
}
