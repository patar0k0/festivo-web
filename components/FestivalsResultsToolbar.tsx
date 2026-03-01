"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { serializeFilters } from "@/lib/filters";
import { Filters } from "@/lib/types";

type FestivalsResultsToolbarProps = {
  filters: Filters;
  total: number;
  activeFiltersCount: number;
  clearHref: string;
};

const RESULTS_PREFIX = "\u041d\u0430\u043c\u0435\u0440\u0435\u043d\u0438";
const SORT_LABEL = "\u0421\u043e\u0440\u0442\u0438\u0440\u0430\u043d\u0435";
const CLEAR_LABEL = "\u0418\u0437\u0447\u0438\u0441\u0442\u0438";

export default function FestivalsResultsToolbar({
  filters,
  total,
  activeFiltersCount,
  clearHref,
}: FestivalsResultsToolbarProps) {
  const router = useRouter();
  const sortValue = filters.sort ?? "soonest";
  const resultsLabel = total === 1 ? "\u0444\u0435\u0441\u0442\u0438\u0432\u0430\u043b" : "\u0444\u0435\u0441\u0442\u0438\u0432\u0430\u043b\u0430";

  const sortQueryBase = useMemo(() => {
    const { sort: _sort, ...rest } = filters;
    void _sort;
    return rest;
  }, [filters]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.08] bg-white/80 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_22px_rgba(12,14,20,0.07)] backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm text-black/70">
        <p className="font-semibold text-[#0c0e14]">
          {RESULTS_PREFIX}: {total} {resultsLabel}
        </p>
        <span className="text-black/35">•</span>
        <p>
          Active filters: <span className="font-semibold text-[#0c0e14]">{activeFiltersCount}</span>
        </p>
        <Link
          href={clearHref}
          scroll={false}
          className="rounded-full border border-black/[0.1] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:border-black/20 hover:bg-[#f8f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
        >
          {CLEAR_LABEL}
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="sort" className="text-xs font-semibold uppercase tracking-[0.16em] text-black/50">
          {SORT_LABEL}
        </label>
        <select
          id="sort"
          value={sortValue}
          onChange={(event) => {
            const nextSort = event.target.value as Filters["sort"];
            const query = serializeFilters({
              ...sortQueryBase,
              sort: nextSort === "soonest" ? undefined : nextSort,
            });
            router.push(`/festivals${query}`, { scroll: false });
          }}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm text-[#0c0e14] focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
        >
          <option value="soonest">Най-скоро</option>
          <option value="curated">Подбрани</option>
          <option value="nearest">Най-близо</option>
        </select>
      </div>
    </div>
  );
}
