"use client";

import { useEffect, useRef, useState } from "react";

// ─── Date picker ─────────────────────────────────────────────────────────────

export function DatePickerButton({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        title="Избери от календар"
        onClick={() => ref.current?.showPicker?.()}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 bg-white text-black/35 transition hover:border-black/20 hover:text-black/70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
      />
    </span>
  );
}

// ─── Time picker ─────────────────────────────────────────────────────────────

const TIME_PICKER_MINUTES = [0, 15, 30, 45];
const TIME_PICKER_HOURS = Array.from({ length: 24 }, (_, i) => i);

export function TimePickerButton({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);

  const parts = value ? value.split(":").map(Number) : [];
  const curH = parts[0] ?? null;
  const curM = parts[1] ?? null;

  useEffect(() => {
    if (!open) return;
    const el = hoursRef.current;
    if (el && curH !== null) {
      const item = el.children[curH] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, curH]);

  const select = (h: number, m: number) => {
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        title="Избери час"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition ${open ? "border-black/30 text-black/80" : "border-black/10 text-black/35 hover:border-black/20 hover:text-black/70"}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 flex overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl">
          {/* Hours */}
          <div ref={hoursRef} className="h-52 w-14 overflow-y-auto border-r border-black/[0.06]">
            {TIME_PICKER_HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => select(h, curM ?? 0)}
                className={`block w-full py-1.5 text-center text-sm transition ${curH === h ? "bg-black font-medium text-white" : "text-black/65 hover:bg-black/[0.04]"}`}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
          {/* Minutes */}
          <div className="w-14">
            {TIME_PICKER_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => select(curH ?? 0, m)}
                className={`block w-full py-1.5 text-center text-sm transition ${curM === m ? "bg-black font-medium text-white" : "text-black/65 hover:bg-black/[0.04]"}`}
              >
                {String(m).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
