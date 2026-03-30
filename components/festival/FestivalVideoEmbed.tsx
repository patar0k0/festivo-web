"use client";

import { getVideoEmbedSrcFromPageUrl } from "@/lib/festival/videoEmbed";

type Props = {
  pageUrl: string;
  title: string;
};

export default function FestivalVideoEmbed({ pageUrl, title }: Props) {
  const src = getVideoEmbedSrcFromPageUrl(pageUrl);
  if (!src) return null;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/80 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)]"
      aria-label="Видео"
    >
      <div className="border-b border-black/[0.06] px-5 py-4">
        <h2 className="text-xl font-semibold text-[#0c0e14]">Видео</h2>
        <p className="mt-1 text-sm text-black/55">YouTube или Facebook</p>
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
