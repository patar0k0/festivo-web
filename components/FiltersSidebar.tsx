"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filters } from "@/lib/types";
import { cn } from "@/lib/utils";
import { serializeFilters } from "@/lib/filters";

const categoryOptions = ["folk", "jazz", "rock", "wine", "food", "kids", "heritage", "art"];
const categoryLabels: Record<string, string> = {
  folk: "Фолклор",
  jazz: "Джаз",
  rock: "Рок",
  wine: "Вино",
  food: "Храна",
  kids: "Семейни",
  heritage: "Традиции",
  art: "Изкуство",
};

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
        "w-full max-w-xs shrink-0 rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur",
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
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Област</label>
          <input
            className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
            placeholder="Родопи"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">От</label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">До</label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ff4c1f]/25"
              value={to}
              onChange={(event) => setTo(event.target.value)}
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
                {categoryLabels[option] ?? option}
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
          onClick={() => router.push(`/festivals${query}`, { scroll: false })}
          className="w-full rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/30"
        >
          Приложи филтри
        </button>
      </div>
    </aside>
  );
}
