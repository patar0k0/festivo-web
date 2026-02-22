"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filters } from "@/lib/types";
import { cn } from "@/lib/utils";
import { serializeFilters } from "@/lib/filters";

const categoryOptions = ["folk", "jazz", "rock", "wine", "food", "kids", "heritage", "art"];

export default function FiltersSidebar({
  initialFilters,
  className,
}: {
  initialFilters: Filters;
  className?: string;
}) {
  const router = useRouter();
  const [city, setCity] = useState(initialFilters.city?.join(",") ?? "");
  const [region, setRegion] = useState(initialFilters.region?.join(",") ?? "");
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [cat, setCat] = useState(initialFilters.cat?.[0] ?? "");
  const [free, setFree] = useState(initialFilters.free ?? true);
  const [sort, setSort] = useState(initialFilters.sort ?? "soonest");

  const query = useMemo(() => {
    const filters: Filters = {
      city: city ? city.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      region: region ? region.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      from: from || undefined,
      to: to || undefined,
      cat: cat ? [cat] : undefined,
      free,
      sort: sort as Filters["sort"],
    };
    return serializeFilters(filters);
  }, [city, region, from, to, cat, free, sort]);

  return (
    <aside
      className={cn(
        "w-full max-w-xs shrink-0 rounded-2xl border border-ink/10 bg-white/70 p-5 shadow-soft",
        className
      )}
    >
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">City</label>
          <input
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2"
            placeholder="Sofia, Plovdiv"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Region</label>
          <input
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2"
            placeholder="Rhodope"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">From</label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">To</label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Category</label>
          <select
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2"
            value={cat}
            onChange={(event) => setCat(event.target.value)}
          >
            <option value="">Any</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Sort</label>
          <select
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2"
            value={sort}
            onChange={(event) => setSort(event.target.value as "soonest" | "curated" | "nearest")}
          >
            <option value="soonest">Soonest</option>
            <option value="curated">Curated</option>
            <option value="nearest">Nearest (stub)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} />
          Free only
        </label>
        <button
          onClick={() => router.push(`/festivals${query}`)}
          className="w-full rounded-xl bg-ink px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
        >
          Apply filters
        </button>
      </div>
    </aside>
  );
}
