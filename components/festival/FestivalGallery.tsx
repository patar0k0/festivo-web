"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import FallbackImage from "@/components/ui/FallbackImage";

export type FestivalGalleryItem = {
  id: string | number;
  url: string;
  caption?: string | null;
};

type Props = {
  items: FestivalGalleryItem[];
  festivalTitle: string;
};

// Max thumbnails visible in the grid (last one shows "+N" overlay when there are more)
const MAX_GRID_ITEMS = 6;

export default function FestivalGallery({ items, festivalTitle }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headingId = useId();
  const lightboxTitleId = useId();
  const touchStartX = useRef<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const len = items.length;

  const goPrev = useCallback(() => {
    setOpenIndex((i) => (i === null || len < 2 ? i : (i + len - 1) % len));
  }, [len]);

  const goNext = useCallback(() => {
    setOpenIndex((i) => (i === null || len < 2 ? i : (i + 1) % len));
  }, [len]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, goPrev, goNext]);

  if (!items.length) return null;

  const current = openIndex !== null ? items[openIndex] : null;

  const visibleItems = items.slice(0, MAX_GRID_ITEMS);
  const hiddenCount = items.length - MAX_GRID_ITEMS;

  // Layout variants based on item count
  const isSingle = items.length === 1;
  const isDouble = items.length === 2;

  function gridClass() {
    if (isSingle) return "grid-cols-1";
    if (isDouble) return "grid-cols-2";
    return "grid-cols-2 sm:grid-cols-3";
  }

  function aspectClass(index: number) {
    if (isSingle) return "aspect-[3/2]";
    if (isDouble) return "aspect-square";
    // 3+ items: first item full-width on mobile (spans 2 cols), square on rest
    if (index === 0) return "aspect-[3/2] col-span-2 sm:col-span-1 sm:aspect-square";
    return "aspect-square";
  }

  function sizesAttr(index: number) {
    if (isSingle) return "100vw";
    if (isDouble) return "50vw";
    if (index === 0) return "(max-width: 640px) 100vw, 33vw";
    return "(max-width: 640px) 50vw, 33vw";
  }

  return (
    <section
      className="rounded-2xl border border-black/[0.08] bg-white/80 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] sm:p-5"
      aria-labelledby={headingId}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold text-[#0c0e14]">
          Галерия
        </h2>
        <p className="text-sm text-black/50">
          {items.length} {items.length === 1 ? "снимка" : "снимки"}
        </p>
      </div>

      <div className={`grid gap-1.5 sm:gap-2 ${gridClass()}`}>
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const showOverlay = isLast && hiddenCount > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              className={`group relative w-full overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.04] text-left shadow-[0_1px_0_rgba(12,14,20,0.04)] transition active:scale-[0.98] hover:border-black/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/70 focus-visible:ring-offset-2 ${aspectClass(index)}`}
            >
              <FallbackImage
                src={item.url}
                alt={item.caption?.trim() ? item.caption : `${festivalTitle} — снимка ${index + 1}`}
                fill
                sizes={sizesAttr(index)}
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
              />
              {/* Hover/active overlay */}
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 group-active:opacity-100" />
              {/* Caption */}
              {item.caption?.trim() && !showOverlay ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2.5 pt-8 text-left text-[11px] font-medium leading-snug text-white line-clamp-2">
                  {item.caption}
                </span>
              ) : null}
              {/* "+N more" overlay on last visible item */}
              {showOverlay ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-bold text-white backdrop-blur-[2px]">
                  +{hiddenCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      {current && openIndex !== null ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-labelledby={lightboxTitleId}
        >
          {/* Top bar */}
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
            <p id={lightboxTitleId} className="min-w-0 truncate text-sm font-semibold text-white">
              {festivalTitle}
              {len > 1 ? (
                <span className="ml-2 font-normal text-white/60">
                  {openIndex + 1} / {len}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={close}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:bg-white/30 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Затвори галерията"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Image area — swipe on this area to navigate */}
          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-2"
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              const delta = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(delta) >= 50) {
                if (delta < 0) goNext();
                else goPrev();
              }
            }}
          >
            {len > 1 ? (
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-1 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition active:bg-white/35 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:left-3 sm:h-11 sm:w-11"
                aria-label="Предишна снимка"
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
                  <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element -- пълноразмерен преглед, външни URL */}
            <img
              src={current.url}
              alt={current.caption?.trim() ? current.caption : `${festivalTitle} — снимка ${openIndex + 1}`}
              className="max-h-[calc(100dvh-130px)] max-w-full object-contain shadow-2xl sm:max-h-[min(80vh,100%)]"
              draggable={false}
            />

            {len > 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="absolute right-1 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition active:bg-white/35 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-3 sm:h-11 sm:w-11"
                aria-label="Следваща снимка"
              >
                <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
                  <path d="M1 1L9 9L1 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            ) : null}
          </div>

          {/* Caption / dot indicator */}
          <div className="shrink-0 px-4 pb-4 pt-3 text-center sm:pb-5">
            {current.caption?.trim() ? (
              <p className="text-sm leading-relaxed text-white/85">{current.caption}</p>
            ) : null}
            {len > 1 && len <= 12 ? (
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setOpenIndex(i)}
                    className={`h-1.5 rounded-full transition-all focus-visible:outline-none ${i === openIndex ? "w-5 bg-white" : "w-1.5 bg-white/40"}`}
                    aria-label={`Снимка ${i + 1}`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
