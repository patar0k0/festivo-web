"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import DdMmYyyyDateInput from "@/components/ui/DdMmYyyyDateInput";
import { labelForPublicCategory } from "@/lib/festivals/publicCategories";
import { pub } from "@/lib/public-ui/styles";
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
        pub.panelMuted,
        "w-full p-5",
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
          onClick={apply}
          className={cn("w-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em]", pub.btnPrimarySm, pub.focusRing)}
        >
          Приложи филтри
        </button>
        <button
          type="button"
          onClick={clearFilters}
          className={cn(
            "w-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-[#f7f6f3]",
            pub.btnSecondarySm,
            pub.focusRing,
          )}
        >
          Изчисти филтрите
        </button>
        {onNearMe ? (
          <button
            type="button"
            onClick={onNearMe}
            className={cn(
              "w-full px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] hover:bg-[#f7f6f3]",
              pub.btnSecondarySm,
              pub.focusRing,
            )}
          >
            До мен
          </button>
        ) : null}
      </div>
    </aside>
  );
}
