"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  logoUrl: string | null | undefined;
  name: string;
  initials: string;
};

export default function OrganizerProfileLogo({ logoUrl, name, initials }: Props) {
  const [failed, setFailed] = useState(false);
  const trimmed = logoUrl?.trim() ?? "";
  const showImage = Boolean(trimmed) && !failed;
  const displayInitials = initials || "OF";

  return (
    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br from-[#f4f6ff] to-[#eef3ff] ring-1 ring-black/5 md:h-28 md:w-28">
      {showImage ? (
        <Image
          src={trimmed}
          alt={name}
          fill
          sizes="(min-width: 768px) 112px, 96px"
          className="object-cover"
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-3xl bg-pine text-2xl font-bold tracking-wide text-white md:text-3xl">
          <span aria-hidden="true">{displayInitials}</span>
        </div>
      )}
    </div>
  );
}
