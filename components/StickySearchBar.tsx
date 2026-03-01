"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { serializeFilters } from "@/lib/filters";
import { Filters } from "@/lib/types";

export default function StickySearchBar({ initialFilters }: { initialFilters?: Filters }) {
  const router = useRouter();
  const [location, setLocation] = useState(initialFilters?.city?.[0] ?? "");
  const [from, setFrom] = useState(initialFilters?.from ?? "");
  const [to, setTo] = useState(initialFilters?.to ?? "");
  const [category, setCategory] = useState(initialFilters?.cat?.[0] ?? "");
  const [freeOnly, setFreeOnly] = useState(initialFilters?.free ?? true);

  const query = useMemo(() => {
    const filters: Filters = {
      city: location ? [location] : undefined,
      from: from || undefined,
      to: to || undefined,
      cat: category ? [category] : undefined,
      free: freeOnly,
      sort: initialFilters?.sort,
      month: initialFilters?.month,
    };
    return serializeFilters(filters);
  }, [location, from, to, category, freeOnly, initialFilters?.month, initialFilters?.sort]);

  return (
    <div className="glass flex w-full flex-col gap-3 rounded-2xl border border-black/[0.08] bg-white/75 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_24px_rgba(12,14,20,0.07)] md:flex-row md:items-end">
      <div className="flex-1 min-w-[12rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Град</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          placeholder="София, Пловдив"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      <div className="min-w-[9rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">От</label>
        <input
          type="date"
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </div>
      <div className="min-w-[9rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">До</label>
        <input
          type="date"
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <div className="min-w-[10rem]">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Категория</label>
        <input
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/85 px-4 py-3 text-sm text-[#0c0e14] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
          placeholder="folk, jazz"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </div>
      <label className="flex items-center gap-2 pt-4 text-sm text-muted md:pt-0">
        <input
          id="freeOnly"
          type="checkbox"
          checked={freeOnly}
          onChange={(event) => setFreeOnly(event.target.checked)}
          className="h-4 w-4 rounded border-black/25 text-[#ff4c1f] focus:ring-[#ff4c1f]/30"
        />
        Само безплатни
      </label>
      <button
        type="button"
        onClick={() => router.push(`/festivals${query}`, { scroll: false })}
        className="rounded-xl bg-[#0c0e14] px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
      >
        Търси
      </button>
    </div>
  );
}
