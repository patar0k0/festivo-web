"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const headingId = useId();
  const lightboxTitleId = useId();
  const lightboxHintId = useId();

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

    const scrollY = window.scrollY;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    document.addEventListener("keydown", onKey);
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    const prevBodyWidth = document.body.style.width;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.right = prevBodyRight;
      document.body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [openIndex, close, goPrev, goNext]);

  if (!items.length) return null;

  const current = openIndex !== null ? items[openIndex] : null;
  const lightbox =
    current && openIndex !== null && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[2000] flex flex-col overflow-y-auto overscroll-contain bg-black/95 p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby={lightboxTitleId}
            aria-describedby={lightboxHintId}
            onClick={close}
            style={{
              paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
              paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-3 top-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/50 text-base font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:right-5 sm:top-5"
              aria-label="Затвори галерията"
            >
              X
            </button>

            <div
              className="flex shrink-0 items-center justify-between gap-3 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="min-w-0">
                <p id={lightboxTitleId} className="min-w-0 truncate pr-14 text-sm font-semibold">
                  {festivalTitle}
                  {len > 1 ? (
                    <span className="ml-2 font-normal text-white/65">
                      {openIndex + 1} / {len}
                    </span>
                  ) : null}
                </p>
                <p id={lightboxHintId} className="mt-1 text-xs text-white/65">
                  Докосни снимката, X или тъмния фон, за да затвориш.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="hidden shrink-0 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:inline-flex"
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
                src={current.url}
                alt={current.caption?.trim() ? current.caption : `${festivalTitle} — снимка ${openIndex + 1}`}
                className="max-h-[min(78vh,100%)] max-w-full cursor-zoom-out object-contain shadow-2xl"
                onClick={close}
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

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 sm:hidden">
              <div className="rounded-[22px] bg-gradient-to-t from-black via-black/90 to-transparent p-1 pt-6">
                <button
                  type="button"
                  onClick={close}
                  className="pointer-events-auto flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white px-4 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#0c0e14] shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition hover:bg-white/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Затвори галерията
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <section
      className="rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]"
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-xl font-semibold text-[#0c0e14]">
            Галерия
          </h2>
          <p className="mt-1 text-sm text-black/55">
            {items.length} {items.length === 1 ? "снимка" : "снимки"} · натисни за цял екран
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.04] text-left shadow-[0_1px_0_rgba(12,14,20,0.04)] transition hover:border-black/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/70 focus-visible:ring-offset-2"
          >
            <FallbackImage
              src={item.url}
              alt={item.caption?.trim() ? item.caption : `${festivalTitle} — снимка ${index + 1}`}
              fill
              sizes="(max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            {item.caption?.trim() ? (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-left text-[11px] font-medium leading-snug text-white line-clamp-2">
                {item.caption}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {lightbox}
    </section>
  );
}
