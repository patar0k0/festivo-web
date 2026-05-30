"use client";

import { useLayoutEffect, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";
import { festivalDiscoveryCalendarBounds } from "@/lib/home/festivalDiscoveryBounds";

type MenuPosition = { top: number; left: number; width: number };

function computeMenuPosition(button: HTMLButtonElement): MenuPosition {
  const rect = button.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const menuHeight = 260;
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUpward = spaceBelow < menuHeight + 20;
  return {
    top: openUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
    left,
    width,
  };
}

export default function DateQuickSelectClient() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!open) { setMenuPos(null); return; }
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
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const { weekendStart, weekendEnd, monthStart, monthEnd } = festivalDiscoveryCalendarBounds();

  const options = [
    { label: "Днес", href: `/festivals?from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}` },
    { label: "Утре", href: (() => { const d = new Date(); d.setDate(d.getDate() + 1); const s = d.toISOString().slice(0, 10); return `/festivals?from=${s}&to=${s}`; })() },
    { label: "Този уикенд", href: `/festivals?from=${weekendStart}&to=${weekendEnd}` },
    { label: "Тази седмица", href: (() => { const d = new Date(); const from = d.toISOString().slice(0, 10); d.setDate(d.getDate() + 6); return `/festivals?from=${from}&to=${d.toISOString().slice(0, 10)}`; })() },
    { label: "Този месец", href: `/festivals?from=${monthStart}&to=${monthEnd}` },
    { label: "Виж календар", href: "/calendar" },
  ];

  const menu = mounted && open && menuPos ? (
    <div
      ref={menuRef}
      role="menu"
      style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 100 }}
      className="overflow-hidden rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
    >
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          role="menuitem"
          onClick={() => { router.push(opt.href); setOpen(false); }}
          className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3]"
        >
          {opt.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(pub.chip, pub.focusRing)}
      >
        Избери дата
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
