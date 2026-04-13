"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useNavigationGeneration } from "@/components/providers/NavigationGenerationProvider";
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

export default function FestivalGallery({ items, festivalTitle }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headingId = useId();
  const lightboxTitleId = useId();
  const navigationGeneration = useNavigationGeneration();

  const close = useCallback(() => setOpenIndex(null), []);
  const len = items.length;

  const goPrev = useCallback(() => {
    if (len < 2) return;
    setOpenIndex((i) => {
      if (i === null) return i;
      const next = (i + len - 1) % len;
      setActiveIndex(next);
      return next;
    });
  }, [len]);

  const goNext = useCallback(() => {
    if (len < 2) return;
    setOpenIndex((i) => {
      if (i === null) return i;
      const next = (i + 1) % len;
      setActiveIndex(next);
      return next;
    });
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

  const active = items[activeIndex] ?? items[0] ?? null;
  const current = openIndex !== null ? items[openIndex] : null;

  return (
    <section
      className="rounded-xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] transition-all duration-200 hover:-translate-y-px hover:shadow-md"
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-xl font-medium text-black/90">
            Галерия
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-black/60">
            {items.length} {items.length === 1 ? "снимка" : "снимки"} · натисни за цял екран
          </p>
        </div>
      </div>

      {active ? (
        <div className="mt-3">
          <button
            type="button"
            className="group relative h-[300px] w-full cursor-pointer overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/35 focus-visible:ring-offset-2 md:h-[340px]"
            onClick={() => setOpenIndex(activeIndex)}
            aria-label={`Отвори снимка ${activeIndex + 1} на цял екран`}
          >
            <FallbackImage
              src={active.url}
              alt={active.caption?.trim() ? active.caption : `${festivalTitle} — снимка ${activeIndex + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              resetKey={active.id}
            />

            <span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />

            {items.length > 1 ? (
              <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
                {activeIndex + 1} / {items.length}
              </span>
            ) : null}
          </button>

          {items.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {items.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border transition-all duration-150 ${
                      isActive ? "border-black" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                    aria-label={`Покажи снимка ${index + 1}`}
                    aria-pressed={isActive}
                  >
                    <FallbackImage
                      src={item.url}
                      alt={item.caption?.trim() ? item.caption : `${festivalTitle} — миниатюра ${index + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                      resetKey={`${item.id}-thumb`}
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {current && openIndex !== null ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/93 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby={lightboxTitleId}
          onClick={close}
        >
          <div
            className="flex shrink-0 items-center justify-between gap-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <p id={lightboxTitleId} className="min-w-0 truncate text-sm font-semibold">
              {festivalTitle}
              {len > 1 ? (
                <span className="ml-2 font-normal text-white/65">
                  {openIndex + 1} / {len}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={close}
              className="shrink-0 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-all duration-150 hover:bg-white/20 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              Затвори
            </button>
          </div>

          <div
            className="relative mt-3 flex min-h-0 flex-1 items-center justify-center"
            onClick={close}
          >
            {len > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
                className="absolute left-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:left-1"
                aria-label="Предишна снимка"
              >
                ‹
              </button>
            ) : null}

            {/* eslint-disable-next-line @next/next/no-img-element -- пълноразмерен преглед, външни URL */}
            <img
              key={`${current.url}-lb-${openIndex}-ng${navigationGeneration}`}
              src={current.url}
              alt={current.caption?.trim() ? current.caption : `${festivalTitle} — снимка ${openIndex + 1}`}
              className="max-h-[min(78vh,100%)] max-w-full rounded-xl object-cover shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {len > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
                className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-2xl text-white backdrop-blur-sm transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-1"
                aria-label="Следваща снимка"
              >
                ›
              </button>
            ) : null}
          </div>

          {current.caption?.trim() ? (
            <p
              className="shrink-0 pt-3 text-center text-sm leading-relaxed text-white/90"
              onClick={(e) => e.stopPropagation()}
            >
              {current.caption}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
