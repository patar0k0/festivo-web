"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type CitySelectClientProps = {
  cities: Array<{ name: string; filterValue: string }>;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

function computeMenuPosition(button: HTMLButtonElement): MenuPosition {
  const rect = button.getBoundingClientRect();
  const maxWidth = Math.min(window.innerWidth * 0.92, 22 * 16);
  const width = Math.max(rect.width, maxWidth);
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
  return {
    top: rect.bottom + 4,
    left,
    width,
  };
}

export default function CitySelectClient({ cities }: CitySelectClientProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }

    const btn = buttonRef.current;
    if (!btn) return;

    const sync = () => setMenuPos(computeMenuPosition(btn));
    sync();

    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [open]);

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
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const onSelect = (filterValue: string) => {
    router.push(`/festivals?city=${encodeURIComponent(filterValue)}`);
    setOpen(false);
  };

  const menu =
    mounted && open && menuPos ? (
      <div
        ref={menuRef}
        id="city-menu"
        role="menu"
        style={{
          position: "fixed",
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          zIndex: 100,
        }}
        className="max-h-[min(60vh,24rem)] overflow-y-auto rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
      >
        {cities.map((city) => (
          <button
            key={city.filterValue}
            type="button"
            role="menuitem"
            onClick={() => onSelect(city.filterValue)}
            className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3]"
          >
            {city.name}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="city-menu"
        className="rounded-2xl border border-black/[0.09] bg-white/90 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/[0.18] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
      >
        Избери град
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
