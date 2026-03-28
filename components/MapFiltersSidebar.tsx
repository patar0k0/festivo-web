"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { Filters } from "@/lib/types";

function updateParam(params: URLSearchParams, key: string, value?: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

const FILTER_KEYS = ["city", "from", "to", "cat", "free", "sort", "month", "page"];

export default function MapFiltersSidebar({
  initialFilters,
  categoryOptions,
  onNearMe,
  className,
}: {
  initialFilters: Filters;
  categoryOptions: string[];
  onNearMe?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [city, setCity] = useState(initialFilters.city?.join(",") ?? "");
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [cat, setCat] = useState(initialFilters.cat?.[0] ?? "");
  const [free, setFree] = useState(initialFilters.free ?? true);
  const [sort, setSort] = useState(initialFilters.sort ?? "soonest");

  const pushComparable = (next: URLSearchParams) => {
    const current = new URLSearchParams(searchParams.toString());
    next.delete("page");
    current.delete("page");
    const currentComparable = current.toString();
    const nextComparable = next.toString();

    if (currentComparable === nextComparable) {
      router.refresh();
      return;
    }

    router.push(nextComparable ? `${pathname}?${nextComparable}` : pathname, { scroll: false });
  };

  const apply = () => {
    const next = new URLSearchParams(searchParams.toString());
    updateParam(next, "city", city || undefined);
    updateParam(next, "from", from || undefined);
    updateParam(next, "to", to || undefined);
    updateParam(next, "cat", cat || undefined);
    updateParam(next, "free", free ? "1" : "0");
    updateParam(next, "sort", sort || undefined);
    pushComparable(next);
  };

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams.toString());
    FILTER_KEYS.forEach((key) => next.delete(key));
    next.set("free", "1");
    pushComparable(next);
  };

  return (
    <aside
      className={cn(
        "w-full rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur",
        className
      )}
    >
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Град</label>
          <input
            className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
            placeholder="София, Пловдив"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">От</label>
            <DdMmYyyyDateInput
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
              value={from}
              onChange={setFrom}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">До</label>
            <DdMmYyyyDateInput
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
              value={to}
              onChange={setTo}
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Категория</label>
          <select
            className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
            value={cat}
            onChange={(event) => setCat(event.target.value)}
          >
            <option value="">Всички</option>
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {labelForPublicCategory(option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Сортиране</label>
          <select
            className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
            value={sort}
            onChange={(event) => setSort(event.target.value as "soonest" | "curated" | "nearest")}
          >
            <option value="soonest">Най-скоро</option>
            <option value="curated">Подбрани</option>
            <option value="nearest">Най-близо</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={free}
            onChange={(event) => setFree(event.target.checked)}
            className="h-4 w-4 rounded border-black/25 text-[#ff4c1f] focus:ring-[#ff4c1f]/30"
          />
          Само безплатни
        </label>
        <button
          type="button"
          onClick={apply}
          className="w-full rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
        >
          Приложи филтри
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className="w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
        >
          Изчисти филтрите
        </button>
        {onNearMe ? (
          <button
            type="button"
            onClick={onNearMe}
            className="w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
          >
            До мен
          </button>
        ) : null}
      </div>
    </aside>
  );
}
