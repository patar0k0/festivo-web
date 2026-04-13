"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

type Props = {
  images: string[];
};

export function FestivalGallery({ images }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const active = images[activeIndex];

  return (
    <div className="mt-3">
      <div
        className="group relative h-[300px] w-full cursor-pointer overflow-hidden rounded-xl md:h-[340px]"
        onClick={() => setLightboxIndex(activeIndex)}
      >
        <img
          src={active}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

        {images.length > 1 ? (
          <div className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
            {activeIndex + 1} / {images.length}
          </div>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              onClick={() => setActiveIndex(i)}
              className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md border ${
                i === activeIndex ? "border-black" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              <img src={img} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxIndex !== null ? (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChange={(i) => setLightboxIndex(i)}
        />
      ) : null}
    </div>
  );
}
