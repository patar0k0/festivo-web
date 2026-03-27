"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type NearMeCtaClientProps = {
  className: string;
};

const FALLBACK_MESSAGE = "Не можем да покажем фестивали около теб без местоположение.";

export default function NearMeCtaClient({ className }: NearMeCtaClientProps) {
  const router = useRouter();
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const onNearMeClick = () => {
    if (!navigator.geolocation) {
      setFallbackMessage(FALLBACK_MESSAGE);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFallbackMessage(null);
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const params = new URLSearchParams({
          geo: "1",
          userLat: lat.toString(),
          userLng: lng.toString(),
        });
        router.push(`/map?${params.toString()}`);
      },
      () => {
        setFallbackMessage(FALLBACK_MESSAGE);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={onNearMeClick} className={className}>
        Открий около мен
      </button>
      {fallbackMessage ? (
        <div className="rounded-xl border border-[#ff4c1f]/20 bg-white/85 px-3 py-2 text-xs text-[#9f3418]">
          <p>{fallbackMessage}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="#home-cities"
              className="rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3]"
            >
              Избери град
            </Link>
            <Link
              href="/festivals"
              className="rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3]"
            >
              Виж всички
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
