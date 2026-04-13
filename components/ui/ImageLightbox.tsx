"use client";

import { useEffect } from "react";

type Props = {
  images: string[];
  index: number;
  onClose: () => void;
  onChange: (i: number) => void;
};

export function ImageLightbox({ images, index, onClose, onChange }: Props) {
  const hasMultiple = images.length > 1;

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onChange((index + 1) % images.length);
      if (e.key === "ArrowLeft") onChange((index - 1 + images.length) % images.length);
    };

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, images.length, onClose, onChange]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90">
      <img src={images[index]} alt="" className="max-h-[85vh] max-w-[90vw] object-contain" />

      <button onClick={onClose} className="absolute right-6 top-6 text-2xl text-white" aria-label="Затвори">
        ✕
      </button>

      {hasMultiple ? (
        <>
          <button
            onClick={() => onChange((index - 1 + images.length) % images.length)}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl text-white"
            aria-label="Предишна снимка"
          >
            ‹
          </button>

          <button
            onClick={() => onChange((index + 1) % images.length)}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-4xl text-white"
            aria-label="Следваща снимка"
          >
            ›
          </button>
        </>
      ) : null}
    </div>
  );
}
