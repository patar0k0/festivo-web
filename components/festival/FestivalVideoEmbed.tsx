"use client";

import { getVideoEmbedSrcFromPageUrl } from "@/lib/festival/videoEmbed";

type Props = {
  pageUrl: string;
  title: string;
  /** Smaller frame and typography — supporting media on festival detail */
  compact?: boolean;
};

export default function FestivalVideoEmbed({ pageUrl, title, compact = false }: Props) {
  const src = getVideoEmbedSrcFromPageUrl(pageUrl);
  if (!src) return null;

  if (compact) {
    return (
      <section
        className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/75 shadow-[0_1px_0_rgba(12,14,20,0.04),0_6px_18px_rgba(12,14,20,0.05)] transition-all duration-200 hover:-translate-y-px hover:shadow-md"
        aria-label="Видео"
      >
        <div className="border-b border-black/[0.06] px-4 py-3 sm:px-5">
          <h2 className="text-lg font-medium text-black/90">Видео</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-black/60">YouTube или Facebook</p>
        </div>
        <div className="px-4 pb-4 pt-3 sm:px-5">
          <div className="mx-auto w-full max-w-[min(100%,20rem)] sm:max-w-[min(100%,24rem)]">
            <div className="relative aspect-video w-full max-h-[min(11.25rem,32vw)] overflow-hidden rounded-xl border border-black/[0.08] bg-black shadow-inner transition-all duration-150 hover:border-black/20 sm:max-h-[min(13.5rem,28vw)]">
              <iframe
                title={`Видео: ${title}`}
                src={src}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/80 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] transition-all duration-200 hover:-translate-y-px hover:shadow-md"
      aria-label="Видео"
    >
      <div className="border-b border-black/[0.06] px-5 py-4">
        <h2 className="text-xl font-medium text-black/90">Видео</h2>
        <p className="mt-1 text-sm leading-relaxed text-black/60">YouTube или Facebook</p>
      </div>
      <div className="relative aspect-video w-full bg-black">
        <iframe
          title={`Видео: ${title}`}
          src={src}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  );
}
