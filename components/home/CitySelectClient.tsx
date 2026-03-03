"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type CitySelectClientProps = {
  cities: Array<{ name: string; slug: string }>;
};

export default function CitySelectClient({ cities }: CitySelectClientProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const onSelect = (slug: string) => {
    router.push(`/festivals?city=${encodeURIComponent(slug)}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="city-menu"
        className="rounded-2xl border border-black/[0.09] bg-white/90 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
      >
        Избери град
      </button>
      {open ? (
        <div
          id="city-menu"
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-10 w-[min(92vw,22rem)] rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
        >
          {cities.map((city) => (
            <button
              key={city.slug}
              type="button"
              role="menuitem"
              onClick={() => onSelect(city.slug)}
              className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3]"
            >
              {city.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
