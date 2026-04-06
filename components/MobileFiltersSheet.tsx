"use client";

import { useState } from "react";
import FiltersSidebar from "@/components/FiltersSidebar";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";
import { Filters } from "@/lib/types";

export default function MobileFiltersSheet({
  initialFilters,
  categoryOptions = [],
}: {
  initialFilters: Filters;
  categoryOptions?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        className={cn(pub.chip, pub.focusRing, "bg-white/85 hover:bg-white")}
      >
        Филтри
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Филтри"
            className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto border-l border-black/[0.08] bg-[#f5f4f0] p-6 shadow-[0_0_0_1px_rgba(12,14,20,0.04),0_20px_40px_rgba(12,14,20,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#0c0e14]">Филтри</h3>
              <button
                onClick={() => setOpen(false)}
                className={cn("rounded-lg px-2 py-1 text-sm text-black/55 transition hover:text-black", pub.focusRing)}
                aria-label="Затвори филтри"
              >
                Затвори
              </button>
            </div>
            <div className="mt-6">
              <FiltersSidebar
                initialFilters={initialFilters}
                categoryOptions={categoryOptions}
                className="max-w-none"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
