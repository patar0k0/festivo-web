"use client";

import { useState } from "react";
import FiltersSidebar from "@/components/FiltersSidebar";
import { Filters } from "@/lib/types";

export default function MobileFiltersSheet({ initialFilters }: { initialFilters: Filters }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-black/[0.1] bg-white/85 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
      >
        Филтри
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-black/[0.08] bg-[#f5f4f0] p-6 shadow-[0_0_0_1px_rgba(12,14,20,0.04),0_20px_40px_rgba(12,14,20,0.18)]">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0c0e14]">Филтри</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-black/55 transition hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
              >
                Затвори
              </button>
            </div>
            <div className="mt-6">
              <FiltersSidebar initialFilters={initialFilters} className="max-w-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
