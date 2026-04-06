"use client";

import { useEffect, useMemo, useState } from "react";
import Image, { type ImageProps } from "next/image";

type FallbackImageProps = Omit<ImageProps, "src" | "alt"> & {
  src?: string | null;
  fallbackSrc?: string;
  alt?: string | null;
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
  ...props
}: FallbackImageProps) {
  const normalizedSrc = useMemo(() => normalizeSrc(src), [src]);
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    setLoadAttempt(0);
  }, [normalizedSrc]);

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
      key={finalSrc}
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
