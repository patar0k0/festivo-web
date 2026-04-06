"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Filters } from "@/lib/types";
import { cn } from "@/lib/utils";
import { serializeFilters } from "@/lib/filters";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { pub } from "@/lib/public-ui/styles";

export default function FiltersSidebar({
  initialFilters,
  categoryOptions,
  className,
}: {
  initialFilters: Filters;
  categoryOptions: string[];
  className?: string;
}) {
  const router = useRouter();
  const [city, setCity] = useState(initialFilters.city?.join(",") ?? "");
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [cat, setCat] = useState(initialFilters.cat?.[0] ?? "");
  const [free, setFree] = useState(initialFilters.free ?? true);
  const [sort, setSort] = useState(initialFilters.sort ?? "soonest");

  const query = useMemo(() => {
    const filters: Filters = {
      city: city ? city.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      from: from || undefined,
      to: to || undefined,
      cat: cat ? [cat] : undefined,
      free,
      sort: sort as Filters["sort"],
    };
    return serializeFilters(filters);
  }, [city, from, to, cat, free, sort]);

  return (
    <aside
      className={cn(
        pub.panelMuted,
        "w-full max-w-xs shrink-0 p-5",
        className
      )}
    >
      <div className="space-y-4 text-sm">
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Град</label>
          <input
            className={cn(pub.input, "mt-2")}
            placeholder="София, Пловдив"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">От</label>
            <DdMmYyyyDateInput
              className={cn(pub.input, "mt-2")}
              value={from}
              onChange={setFrom}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-muted">До</label>
            <DdMmYyyyDateInput
              className={cn(pub.input, "mt-2")}
              value={to}
              onChange={setTo}
            />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.2em] text-muted">Категория</label>
          <select
            className={cn(pub.input, "mt-2")}
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
            className={cn(pub.input, "mt-2")}
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
            className={pub.checkboxAccent}
          />
          Само безплатни
        </label>
        <button
          type="button"
          onClick={() => router.push(`/festivals${query}`, { scroll: false })}
          className={cn("w-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em]", pub.btnPrimarySm, pub.focusRing)}
        >
          Приложи филтри
        </button>
      </div>
    </aside>
  );
}
