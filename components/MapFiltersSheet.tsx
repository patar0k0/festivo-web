"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import MapFiltersSidebar from "@/components/MapFiltersSidebar";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
import { Filters } from "@/lib/types";

type MapFiltersSheetProps = {
  initialFilters: Filters;
  categoryOptions: string[];
  onNearMe?: () => void;
  floating?: boolean;
};

const COPY = {
  open: "Филтри",
  close: "Затвори",
};

export default function MapFiltersSheet({
  initialFilters,
  categoryOptions,
  onNearMe,
  floating = false,
}: MapFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  // The sheet must render into document.body via a portal — otherwise its
  // `position: fixed` overlay gets contained inside the sticky chip bar's
  // `backdrop-filter` ancestor (CSS spec: backdrop-filter creates a
  // containing block for fixed-positioned descendants). That bug surfaced
  // as the sheet appearing inline next to the chip row instead of as a
  // full-screen overlay. The portal escapes the containing-block scope.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Body scroll lock while the sheet is open — prevents the page behind
  // from scrolling under the modal on mobile.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes the sheet (keyboard accessibility for the modal pattern).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const overlay = open ? (
    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={COPY.open}
        className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-black/[0.08] bg-[#f5f4f0] p-6 shadow-[0_0_0_1px_rgba(12,14,20,0.04),0_20px_40px_rgba(12,14,20,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#0c0e14]">{COPY.open}</h3>
          <button
            onClick={() => setOpen(false)}
            className={cn("rounded-lg px-2 py-1 text-sm text-black/55 transition hover:text-black", pub.focusRing)}
            aria-label={COPY.close}
          >
            {COPY.close}
          </button>
        </div>
        <div className="mt-6">
          <MapFiltersSidebar
            initialFilters={initialFilters}
            categoryOptions={categoryOptions}
            onNearMe={onNearMe}
            className="max-w-none"
          />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          pub.chip,
          pub.focusRing,
          "shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_18px_rgba(12,14,20,0.08)] hover:bg-white",
          floating && "px-5 py-3",
        )}
        type="button"
      >
        {COPY.open}
      </button>
      {mounted && overlay ? createPortal(overlay, document.body) : null}
    </>
  );
}
