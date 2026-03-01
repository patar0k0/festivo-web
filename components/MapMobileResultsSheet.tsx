"use client";

import { useState } from "react";

type MapMobileResultsSheetProps = {
  count: number;
  children: React.ReactNode;
};

const COPY = {
  title: "\u0420\u0435\u0437\u0443\u043b\u0442\u0430\u0442\u0438",
  open: "\u041f\u043e\u043a\u0430\u0436\u0438",
  close: "\u0421\u043a\u0440\u0438\u0439",
};

export default function MapMobileResultsSheet({ count, children }: MapMobileResultsSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3">
      <div className="rounded-t-2xl border border-black/[0.08] bg-white/92 shadow-[0_-2px_0_rgba(12,14,20,0.05),0_-14px_28px_rgba(12,14,20,0.1)] backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          aria-expanded={open}
        >
          <span>
            {COPY.title} ({count})
          </span>
          <span className="text-xs uppercase tracking-[0.14em] text-black/60">{open ? COPY.close : COPY.open}</span>
        </button>
        {open ? <div className="max-h-[52vh] overflow-y-auto border-t border-black/[0.08] p-3">{children}</div> : null}
      </div>
    </div>
  );
}
