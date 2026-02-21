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
    };
    return serializeFilters(filters);
  }, [location, from, to, category, freeOnly]);

  return (
    <div className="glass flex w-full flex-col gap-3 rounded-2xl p-4 shadow-soft md:flex-row md:items-end">
      <div className="flex-1">
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Location</label>
        <input
          className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Sofia, Plovdiv"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-muted">From</label>
        <input
          type="date"
          className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-muted">To</label>
        <input
          type="date"
          className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-muted">Type</label>
        <input
          className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          placeholder="Folk, Jazz"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 pt-4 md:pt-0">
        <input
          id="freeOnly"
          type="checkbox"
          checked={freeOnly}
          onChange={(event) => setFreeOnly(event.target.checked)}
        />
        <label htmlFor="freeOnly" className="text-sm text-muted">
          Free only
        </label>
      </div>
      <button
        onClick={() => router.push(`/festivals${query}`)}
        className="rounded-xl bg-ink px-6 py-3 text-sm font-semibold uppercase tracking-widest text-white"
      >
        Search
      </button>
    </div>
  );
}
