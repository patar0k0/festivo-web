"use client";

import { useMemo, useState } from "react";
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
  const finalSrc = !failed && normalizedSrc ? normalizedSrc : fallbackSrc;
  const normalizedAlt = typeof alt === "string" && alt.trim().length > 0 ? alt : "Image";

  return (
    <Image
      {...props}
      src={finalSrc}
      alt={normalizedAlt}
      onError={() => {
        setFailed(true);
      }}
    />
  );
}
