"use client";

import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { festivalDiscoveryCalendarBounds } from "@/lib/home/festivalDiscoveryBounds";

type CityOption = { name: string; slug: string | null; filterValue: string };
type MenuPos = { top: number; left: number; width: number };

function getSofiaDateString(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 86400000));
  const y = parts.find(p => p.type === "year")?.value ?? "";
  const m = parts.find(p => p.type === "month")?.value ?? "";
  const d = parts.find(p => p.type === "day")?.value ?? "";
  return `${y}-${m}-${d}`;
}

function calcMenuPos(btn: HTMLButtonElement, menuHeight: number): MenuPos {
  const rect = btn.getBoundingClientRect();
  const maxW = Math.min(window.innerWidth * 0.92, 22 * 16);
  const width = Math.max(rect.width, maxW);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const spaceBelow = window.innerHeight - rect.bottom;
  const openUpward = spaceBelow < menuHeight + 16;
  return {
    top: openUpward ? Math.max(8, rect.top - menuHeight - 4) : rect.bottom + 4,
    left,
    width,
  };
}

export interface FestivalsCompoundSearchProps {
  cities: CityOption[];
  initialQuery?: string;
  initialCity?: string;
  initialFrom?: string;
  initialTo?: string;
}

export default function FestivalsCompoundSearch({
  cities,
  initialQuery = "",
  initialCity = "",
  initialFrom = "",
  initialTo = "",
}: FestivalsCompoundSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);
  const [cityOpen, setCityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cityMenuPos, setCityMenuPos] = useState<MenuPos | null>(null);
  const [dateMenuPos, setDateMenuPos] = useState<MenuPos | null>(null);

  const cityBtnRef = useRef<HTMLButtonElement>(null);
  const dateBtnRef = useRef<HTMLButtonElement>(null);
  const cityMenuRef = useRef<HTMLDivElement>(null);
  const dateMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!cityOpen) { setCityMenuPos(null); return; }
    const btn = cityBtnRef.current;
    if (!btn) return;
    const sync = () => setCityMenuPos(calcMenuPos(btn, Math.min(window.innerHeight * 0.6, 384)));
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => { window.removeEventListener("scroll", sync, true); window.removeEventListener("resize", sync); };
  }, [cityOpen]);

  useLayoutEffect(() => {
    if (!dateOpen) { setDateMenuPos(null); return; }
    const btn = dateBtnRef.current;
    if (!btn) return;
    const sync = () => setDateMenuPos(calcMenuPos(btn, 280));
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => { window.removeEventListener("scroll", sync, true); window.removeEventListener("resize", sync); };
  }, [dateOpen]);

  useEffect(() => {
    if (!cityOpen && !dateOpen) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (cityOpen && !cityBtnRef.current?.contains(t) && !cityMenuRef.current?.contains(t)) setCityOpen(false);
      if (dateOpen && !dateBtnRef.current?.contains(t) && !dateMenuRef.current?.contains(t)) setDateOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setCityOpen(false); setDateOpen(false); return; }
      const activeMenu = cityOpen ? cityMenuRef.current : dateOpen ? dateMenuRef.current : null;
      if (!activeMenu) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(activeMenu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
        if (!items.length) return;
        const current = document.activeElement as HTMLButtonElement;
        const idx = items.indexOf(current);
        if (e.key === "ArrowDown") items[(idx + 1) % items.length]?.focus();
        if (e.key === "ArrowUp") items[(idx - 1 + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("pointerdown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [cityOpen, dateOpen]);

  const { weekendStart, weekendEnd, monthStart, monthEnd } = festivalDiscoveryCalendarBounds();
  const today = getSofiaDateString(0);
  const tomorrow = getSofiaDateString(1);
  const endOfWeek = (() => {
    const sofiaDay = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Sofia", weekday: "short" })
      .format(new Date()).toLowerCase();
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const dayNum = dayMap[sofiaDay] ?? 0;
    const daysUntilSunday = dayNum === 0 ? 0 : 7 - dayNum;
    return getSofiaDateString(daysUntilSunday);
  })();

  const datePresets = [
    { label: "Днес", from: today, to: today },
    { label: "Утре", from: tomorrow, to: tomorrow },
    { label: "Този уикенд", from: weekendStart, to: weekendEnd },
    { label: "Тази седмица", from: today, to: endOfWeek },
    { label: "Този месец", from: monthStart, to: monthEnd },
  ];

  const selectedDateLabel = datePresets.find(p => p.from === dateFrom && p.to === dateTo)?.label
    ?? (dateFrom ? dateFrom : null);
  const selectedCityLabel = city
    ? (cities.find(c => c.filterValue === city || c.slug === city)?.name ?? city)
    : null;

  const handleSubmit = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    router.push(`/festivals${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const clearCity = () => setCity("");
  const clearDate = () => { setDateFrom(""); setDateTo(""); };

  const activeFilters: Array<{ label: string; type: string; onRemove: () => void }> = [
    ...(selectedCityLabel ? [{ label: selectedCityLabel, type: "city", onRemove: clearCity }] : []),
    ...(selectedDateLabel ? [{ label: selectedDateLabel, type: "date", onRemove: clearDate }] : []),
  ];

  const xIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  );
  const chevron = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/35" aria-hidden>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  );

  const cityMenu = mounted && cityOpen && cityMenuPos ? createPortal(
    <div
      ref={cityMenuRef}
      id="city-select-menu"
      role="menu"
      aria-label="Избери град"
      style={{ position: "fixed", top: cityMenuPos.top, left: cityMenuPos.left, width: cityMenuPos.width, zIndex: 200 }}
      className="max-h-[min(60vh,24rem)] overflow-y-auto rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
    >
      <button type="button" role="menuitem" onClick={() => { setCity(""); setCityOpen(false); }}
        className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-black/40 transition hover:bg-[#f7f6f3]">
        Всички градове
      </button>
      {cities.map(c => (
        <button key={c.filterValue} type="button" role="menuitem"
          onClick={() => { setCity(c.filterValue); setCityOpen(false); }}
          className={cn(
            "block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-[#f7f6f3]",
            city === c.filterValue ? "bg-[#7c2d12]/10 text-[#7c2d12]" : "text-[#0c0e14]"
          )}>
          {c.name}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  const dateMenu = mounted && dateOpen && dateMenuPos ? createPortal(
    <div
      ref={dateMenuRef}
      id="date-select-menu"
      role="menu"
      aria-label="Избери дата"
      style={{ position: "fixed", top: dateMenuPos.top, left: dateMenuPos.left, width: Math.max(dateMenuPos.width, 190), zIndex: 200 }}
      className="overflow-hidden rounded-2xl border border-black/[0.09] bg-white p-2 shadow-[0_8px_20px_rgba(12,14,20,0.14)]"
    >
      <button type="button" role="menuitem" onClick={() => { clearDate(); setDateOpen(false); }}
        className="block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-black/40 transition hover:bg-[#f7f6f3]">
        Всякога
      </button>
      {datePresets.map(p => (
        <button key={p.label} type="button" role="menuitem"
          onClick={() => { setDateFrom(p.from); setDateTo(p.to); setDateOpen(false); }}
          className={cn(
            "block w-full rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition hover:bg-[#f7f6f3]",
            dateFrom === p.from && dateTo === p.to ? "bg-[#7c2d12]/10 text-[#7c2d12]" : "text-[#0c0e14]"
          )}>
          {p.label}
        </button>
      ))}
    </div>,
    document.body
  ) : null;

  return (
    <div className="space-y-2.5">
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="flex flex-col gap-0 overflow-hidden rounded-2xl border border-black/[0.1] bg-white shadow-sm md:flex-row md:items-stretch"
      >
        {/* Text */}
        <div className="flex flex-1 items-center gap-2.5 border-b border-black/[0.07] px-4 py-3 md:border-b-0 md:border-r">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 text-black/30" aria-hidden>
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Фестивал, ключума, събитие..."
            aria-label="Търси фестивал"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#0c0e14] outline-none placeholder:text-black/30"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="shrink-0 text-black/25 hover:text-black/55" aria-label="Изчисти текст">
              {xIcon}
            </button>
          ) : null}
        </div>

        {/* City */}
        <div className="flex items-center gap-2.5 border-b border-black/[0.07] px-4 py-3 md:border-b-0 md:border-r md:min-w-[9.5rem]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 text-black/30" aria-hidden>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <button
            ref={cityBtnRef}
            type="button"
            onClick={() => { setCityOpen(v => !v); setDateOpen(false); }}
            aria-expanded={cityOpen}
            aria-haspopup="menu"
            aria-controls="city-select-menu"
            className={cn("flex-1 text-left text-sm font-medium outline-none",
              selectedCityLabel ? "text-[#0c0e14]" : "text-black/30")}
          >
            {selectedCityLabel ?? "Град"}
          </button>
          {selectedCityLabel
            ? <button type="button" onClick={clearCity} className="shrink-0 text-black/25 hover:text-black/55" aria-label="Изчисти град">{xIcon}</button>
            : chevron}
        </div>

        {/* Date */}
        <div className="flex items-center gap-2.5 border-b border-black/[0.07] px-4 py-3 md:border-b-0 md:min-w-[9rem]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="shrink-0 text-black/30" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <button
            ref={dateBtnRef}
            type="button"
            onClick={() => { setDateOpen(v => !v); setCityOpen(false); }}
            aria-expanded={dateOpen}
            aria-haspopup="menu"
            aria-controls="date-select-menu"
            className={cn("flex-1 text-left text-sm font-medium outline-none",
              selectedDateLabel ? "text-[#0c0e14]" : "text-black/30")}
          >
            {selectedDateLabel ?? "Дата"}
          </button>
          {selectedDateLabel
            ? <button type="button" onClick={clearDate} className="shrink-0 text-black/25 hover:text-black/55" aria-label="Изчисти дата">{xIcon}</button>
            : chevron}
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="mx-3 mb-3 rounded-xl bg-[#7c2d12] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6b2510] active:scale-[0.98] md:mx-1.5 md:my-1.5 md:rounded-xl"
        >
          Търси
        </button>
      </form>

      {/* Active filter chips */}
      {activeFilters.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map(f => (
            <button
              key={f.type}
              type="button"
              onClick={f.onRemove}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#7c2d12]/25 bg-[#7c2d12]/[0.07] px-3 py-1 text-xs font-semibold text-[#7c2d12] transition hover:bg-[#7c2d12]/[0.14]"
            >
              {f.label}
              {xIcon}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { clearCity(); clearDate(); setQuery(""); router.push("/festivals"); }}
            className="text-xs text-black/35 transition hover:text-black/60 hover:underline"
          >
            Изчисти всички
          </button>
        </div>
      ) : null}

      {cityMenu}
      {dateMenu}
    </div>
  );
}
