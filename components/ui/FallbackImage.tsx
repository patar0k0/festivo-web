"use client";

import { useMemo, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { usePathname } from "next/navigation";
import { useNavigationGeneration } from "@/components/providers/NavigationGenerationProvider";
import { useImageLoadReset } from "@/components/ui/useImageLoadReset";

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

  // Remote images (Supabase storage, fbcdn) are routed through Next.js image
  // optimizer by default — generates AVIF/WebP + srcset per `sizes`, cuts LCP
  // payload ~10x. Callers that need to bypass the optimizer (e.g. avatar / logo
  // upload previews, or images on hosts not in `remotePatterns`) should pass
  // `unoptimized` explicitly. See `next.config.js` for the allowed remote hosts.
  const unoptimized = unoptimizedProp ?? false;

  const resolvedSrc = useMemo(() => {
    if (!normalizedSrc) return null;
    if (loadAttempt === 0) return normalizedSrc;
    const sep = normalizedSrc.includes("?") ? "&" : "?";
    return `${normalizedSrc}${sep}_festivo_retry=${loadAttempt}`;
  }, [normalizedSrc, loadAttempt]);

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
