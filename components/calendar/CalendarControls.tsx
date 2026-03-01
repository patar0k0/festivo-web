"use client";

import { FormEvent, useState } from "react";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { festivalCategories, festivalCategoryLabels } from "@/components/CategoryChips";
import { Filters } from "@/lib/types";

type CalendarControlsProps = {
  month: string;
  initialFilters: Filters;
};

function setOrDelete(params: URLSearchParams, key: string, value?: string) {
  if (value) {
    params.set(key, value);
  } else {
    params.delete(key);
  }
}

export default function CalendarControls({ month, initialFilters }: CalendarControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [city, setCity] = useState(initialFilters.city?.[0] ?? "");
  const [category, setCategory] = useState(initialFilters.cat?.[0] ?? "");
  const [from, setFrom] = useState(initialFilters.from ?? "");
  const [to, setTo] = useState(initialFilters.to ?? "");
  const [freeOnly, setFreeOnly] = useState(initialFilters.free ?? true);

  const today = new Date();
  const weekendFrom = format(nextSaturday(today), "yyyy-MM-dd");
  const weekendTo = format(nextSunday(today), "yyyy-MM-dd");
  const monthFrom = format(startOfMonth(today), "yyyy-MM-dd");
  const monthTo = format(endOfMonth(today), "yyyy-MM-dd");

  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const currentCat = searchParams.get("cat") ?? "";
  const freeParam = searchParams.get("free");
  const freeActive = freeParam === null ? true : freeParam === "1" || freeParam === "true";

  const pushParams = (mutate: (params: URLSearchParams) => void) => {
    const current = new URLSearchParams(searchParams.toString());
    const next = new URLSearchParams(searchParams.toString());

    mutate(next);
    next.set("month", month);
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

  const onApply = (event: FormEvent) => {
    event.preventDefault();
    pushParams((params) => {
      setOrDelete(params, "city", city || undefined);
      setOrDelete(params, "cat", category || undefined);
      setOrDelete(params, "from", from || undefined);
      setOrDelete(params, "to", to || undefined);
      setOrDelete(params, "free", freeOnly ? "1" : "0");
    });
  };

  const toggleFree = () => {
    pushParams((params) => {
      params.set("free", freeActive ? "0" : "1");
    });
  };

  const toggleWeekend = () => {
    const active = currentFrom === weekendFrom && currentTo === weekendTo;
    pushParams((params) => {
      if (active) {
        params.delete("from");
        params.delete("to");
        return;
      }

      params.set("from", weekendFrom);
      params.set("to", weekendTo);
    });
  };

  const toggleThisMonth = () => {
    const active = currentFrom === monthFrom && currentTo === monthTo;
    pushParams((params) => {
      if (active) {
        params.delete("from");
        params.delete("to");
        return;
      }

      params.set("from", monthFrom);
      params.set("to", monthTo);
    });
  };

  const toggleCategory = (value: string) => {
    pushParams((params) => {
      if (currentCat === value) {
        params.delete("cat");
      } else {
        params.set("cat", value);
      }
    });
  };

  const popularCategories = Array.from(new Set(festivalCategories)).slice(0, 5);

  return (
    <div className="space-y-4">
      <form onSubmit={onApply} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_10rem_10rem_auto_auto]">
        <label className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Град</span>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="София, Пловдив"
            className="mt-2 rounded-xl border border-black/[0.1] bg-white/90 px-4 py-2.5 text-sm text-[#0c0e14] placeholder:text-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Категория</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="mt-2 rounded-xl border border-black/[0.1] bg-white/90 px-4 py-2.5 text-sm text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          >
            <option value="">Всички</option>
            {festivalCategories.map((option) => (
              <option key={option} value={option}>
                {festivalCategoryLabels[option] ?? option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">От</span>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-2 rounded-xl border border-black/[0.1] bg-white/90 px-4 py-2.5 text-sm text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          />
        </label>

        <label className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">До</span>
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-2 rounded-xl border border-black/[0.1] bg-white/90 px-4 py-2.5 text-sm text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
          />
        </label>

        <label className="flex items-center gap-2 self-end rounded-xl border border-black/[0.1] bg-white/90 px-3 py-2.5 text-sm text-[#0c0e14]">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(event) => setFreeOnly(event.target.checked)}
            className="h-4 w-4 rounded border-black/25 text-[#ff4c1f] focus:ring-[#ff4c1f]/30"
          />
          Само безплатни
        </label>

        <button
          type="submit"
          className="self-end rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
        >
          Приложи
        </button>
      </form>

      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max gap-2">
          <button
            type="button"
            onClick={toggleFree}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
              freeActive
                ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
            }`}
          >
            Само безплатни
          </button>

          <button
            type="button"
            onClick={toggleWeekend}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
              currentFrom === weekendFrom && currentTo === weekendTo
                ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
            }`}
          >
            Този уикенд
          </button>

          <button
            type="button"
            onClick={toggleThisMonth}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
              currentFrom === monthFrom && currentTo === monthTo
                ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
            }`}
          >
            Този месец
          </button>

          {popularCategories.map((categoryOption) => {
            const active = currentCat === categoryOption;
            return (
              <button
                key={categoryOption}
                type="button"
                onClick={() => toggleCategory(categoryOption)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                  active
                    ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                    : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
                }`}
              >
                {festivalCategoryLabels[categoryOption] ?? categoryOption}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
