"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type Props = {
  logoUrl: string | null | undefined;
  name: string;
  initials: string;
  /** Larger treatment for public organizer hero. */
  variant?: "default" | "hero";
};

export default function OrganizerProfileLogo({ logoUrl, name, initials, variant = "default" }: Props) {
  const pathname = usePathname();
  const [failed, setFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const trimmed = logoUrl?.trim() ?? "";

  useEffect(() => {
    setFailed(false);
    setLoadAttempt(0);
  }, [trimmed, pathname]);

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setFailed(false);
        setLoadAttempt(0);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const displayUrl = useMemo(() => {
    if (!trimmed) return "";
    if (loadAttempt === 0) return trimmed;
    const sep = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${sep}_festivo_logo_retry=${loadAttempt}`;
  }, [trimmed, loadAttempt]);

  const showImage = Boolean(displayUrl) && !failed;
  const displayInitials = initials || "OF";
  const isHero = variant === "hero";

  const frame =
    isHero
      ? "h-[7.5rem] w-[7.5rem] rounded-[1.35rem] shadow-md ring-1 ring-black/[0.06] md:h-[9.5rem] md:w-[9.5rem] md:rounded-[1.5rem] lg:h-[10.5rem] lg:w-[10.5rem]"
      : "h-24 w-24 rounded-3xl ring-1 ring-black/5 md:h-28 md:w-28";

  const sizes = isHero
    ? "(min-width: 1024px) 168px, (min-width: 768px) 152px, 120px"
    : "(min-width: 768px) 112px, 96px";

  const initialsClass = isHero
    ? "text-3xl font-semibold tracking-tight text-slate-600 md:text-4xl lg:text-[2.35rem]"
    : "text-2xl font-bold tracking-wide text-slate-600 md:text-3xl";

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/90 ${frame}`}
      {...(!showImage ? { "aria-label": `${name} — лого` } : {})}
    >
      {showImage ? (
        <Image
          key={displayUrl}
          src={displayUrl}
          alt={name}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized
          priority={variant === "hero"}
          onError={() => {
            setLoadAttempt((c) => {
              if (c < 2) return c + 1;
              setFailed(true);
              return c;
            });
          }}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/80 ${initialsClass}`}
          aria-hidden
        >
          <span>{displayInitials}</span>
        </div>
      )}
    </div>
  );
}
