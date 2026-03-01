"use client";

import { useState } from "react";
import MapFiltersSidebar from "@/components/MapFiltersSidebar";
import { Filters } from "@/lib/types";

type MapFiltersSheetProps = {
  initialFilters: Filters;
  floating?: boolean;
};

const COPY = {
  open: "\u0424\u0438\u043b\u0442\u0440\u0438",
  close: "\u0417\u0430\u0442\u0432\u043e\u0440\u0438",
};

export default function MapFiltersSheet({ initialFilters, floating = false }: MapFiltersSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className={`rounded-full border border-black/[0.1] bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_18px_rgba(12,14,20,0.08)] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
          floating ? "px-5 py-3" : ""
        }`}
      >
        {COPY.open}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={COPY.open}
            className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-black/[0.08] bg-[#f5f4f0] p-6 shadow-[0_0_0_1px_rgba(12,14,20,0.04),0_20px_40px_rgba(12,14,20,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0c0e14]">{COPY.open}</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-black/55 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                aria-label={COPY.close}
              >
                {COPY.close}
              </button>
            </div>
            <div className="mt-6">
              <MapFiltersSidebar initialFilters={initialFilters} className="max-w-none" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
