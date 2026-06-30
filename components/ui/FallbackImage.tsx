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

/**
 * Picks a transform width for Supabase-CDN delivery. Prefers an explicit numeric
 * `width` prop; otherwise the largest fixed `px` value in `sizes` (×2 for retina).
 * Viewport-relative sizes (vw/vh/%) are layout-dependent → fall back to 750px,
 * which covers 100vw mobile up to tablet 50vw @2x.
 */
function deriveTransformWidth(sizes?: string, width?: ImageProps["width"]): number {
  if (typeof width === "number" && width > 0) return Math.min(Math.round(width * 2), 1920);
  if (sizes && !/\d+(?:vw|vh|%)/.test(sizes)) {
    const pxValues = Array.from(sizes.matchAll(/(\d+)px/g), (m) => Number(m[1]));
    const max = pxValues.length ? Math.max(...pxValues) : 0;
    if (max > 0) return Math.min(max * 2, 1920);
  }
  return 750;
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

  // Serve ALL Supabase storage images via the Supabase Transform API (Cloudflare
  // CDN) instead of Vercel's image optimizer. The optimizer enforces a monthly
  // transformation quota — once exhausted, every cache-miss returns HTTP 402
  // (`OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`) and the image fails to load.
  // The Transform CDN has no such per-request billing gate (and also avoids the
  // cold-cache encoding overhead). Non-Supabase URLs (e.g. fbcdn.net) return null
  // and keep flowing through the Next.js optimizer.
  const supabaseTransformSrc = useMemo(() => {
    if (!normalizedSrc) return null;
    return toSupabaseTransformUrl(normalizedSrc, {
      width: deriveTransformWidth(props.sizes, props.width),
      quality: 60,
    });
  }, [normalizedSrc, props.sizes, props.width]);

  const resolvedSrc = useMemo(() => {
    const base = supabaseTransformSrc ?? normalizedSrc;
    if (!base) return null;
    if (loadAttempt === 0) return base;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}_festivo_retry=${loadAttempt}`;
  }, [supabaseTransformSrc, normalizedSrc, loadAttempt]);

  const showingFallback = failed || !resolvedSrc;
  const finalSrc = showingFallback ? fallbackSrc : resolvedSrc;
  const normalizedAlt = typeof alt === "string" && alt.trim().length > 0 ? alt : "Image";

  // Transform-served Supabase images bypass the Vercel optimizer; so does the
  // local fallback, so the placeholder still renders even while the optimizer
  // quota is exhausted. Everything else keeps the optimizer (explicit prop wins).
  const unoptimized = unoptimizedProp ?? (supabaseTransformSrc !== null || showingFallback);

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
