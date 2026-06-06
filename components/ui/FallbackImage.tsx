"use client";

import { useMemo, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { usePathname } from "next/navigation";
import { useNavigationGeneration } from "@/components/providers/NavigationGenerationProvider";
import { useImageLoadReset } from "@/components/ui/useImageLoadReset";
import { toSupabaseTransformUrl } from "@/lib/storage/supabaseTransform";

type FallbackImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  fallbackSrc?: string;
  alt?: string | null;
  /** Entity identity (e.g. festival id) so error state resets even when `src` matches another row. */
  resetKey?: string | number | null;
};

function normalizeSrc(src?: string | null): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return null;
}

export default function FallbackImage({
  src,
  fallbackSrc = "/images/placeholder.jpg",
  alt,
  resetKey,
  unoptimized: unoptimizedProp,
  ...props
}: FallbackImageProps) {
  const normalizedSrc = useMemo(() => normalizeSrc(src), [src]);
  const pathname = usePathname();
  const navigationGeneration = useNavigationGeneration();
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useImageLoadReset(
    () => {
      setFailed(false);
      setLoadAttempt(0);
    },
    normalizedSrc,
    pathname,
    resetKey,
  );

  // Priority (LCP) images from Supabase storage are served via the Supabase
  // Transform API (Cloudflare CDN) instead of Vercel's image optimizer, which
  // has a cold-cache encoding overhead on first visit. Non-Supabase URLs
  // (e.g. fbcdn.net) and non-priority images continue through Next.js optimizer.
  const supabaseTransformSrc = useMemo(() => {
    if (!props.priority || !normalizedSrc) return null;
    // Derive pixel width from the sizes prop if available, else default 750px
    // (covers 100vw mobile up to tablet 50vw @2x).
    return toSupabaseTransformUrl(normalizedSrc, { width: 750, quality: 72 });
  }, [props.priority, normalizedSrc]);

  const unoptimized = unoptimizedProp ?? supabaseTransformSrc !== null;

  const resolvedSrc = useMemo(() => {
    const base = supabaseTransformSrc ?? normalizedSrc;
    if (!base) return null;
    if (loadAttempt === 0) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}_festivo_retry=${loadAttempt}`;
  }, [supabaseTransformSrc, normalizedSrc, loadAttempt]);

  const finalSrc = !failed && resolvedSrc ? resolvedSrc : fallbackSrc;
  const normalizedAlt = typeof alt === "string" && alt.trim().length > 0 ? alt : "Image";

  return (
    <Image
      {...props}
      unoptimized={unoptimized}
      key={`${finalSrc}__ng${navigationGeneration}`}
      src={finalSrc}
      alt={normalizedAlt}
      onError={() => {
        setLoadAttempt((c) => {
          if (c < 2) return c + 1;
          setFailed(true);
          return c;
        });
      }}
    />
  );
}
