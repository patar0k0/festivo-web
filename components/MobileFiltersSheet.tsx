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
        className="rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
      >
        Filters
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filters</h3>
              <button onClick={() => setOpen(false)} className="text-sm text-muted">
                Close
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
