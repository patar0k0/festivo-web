"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import ViewToggle from "@/components/ViewToggle";
import { festivalCategories, festivalCategoryLabels } from "@/components/CategoryChips";
import MapSearchBar from "@/components/MapSearchBar";
import MapFiltersSidebar from "@/components/MapFiltersSidebar";
import MapFiltersSheet from "@/components/MapFiltersSheet";
import MapViewClient from "@/components/MapViewClient";
import MapResultsList from "@/components/MapResultsList";
import MapMobileResultsSheet from "@/components/MapMobileResultsSheet";
import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { Festival, Filters } from "@/lib/types";

type MapPageClientProps = {
  filters: Filters;
  festivals: Festival[];
  total: number;
};

type FocusCoords = {
  lat: number;
  lng: number;
  zoom?: number;
};

const COPY = {
  title: "Карта на фестивалите",
  subtitle: "Виж какво има около теб и филтрирай по град, дата и категория.",
  free: "Само безплатни",
  weekend: "Този уикенд",
  month: "Този месец",
  results: "Резултати",
  mapCount: "На картата",
  totalCount: "Общо",
  nearMe: "До мен",
  resetView: "Reset view",
  resetFilters: "Reset filters",
  clear: "Изчисти",
  geoDenied: "Разреши локация, за да центрираме картата.",
};

const FILTER_PARAM_KEYS = ["city", "region", "from", "to", "cat", "free", "sort", "month", "q", "search", "radius", "page"];

function paramsWithPageReset(params: URLSearchParams) {
  params.delete("page");
  return params;
}

export default function MapPageClient({ filters, festivals, total }: MapPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedFestivalId, setSelectedFestivalId] = useState<string | number | null>(null);
  const [focusCoords, setFocusCoords] = useState<FocusCoords | null>(null);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const mapPoints = useMemo(
    () => festivals.filter((festival) => festival.lat != null && festival.lng != null),
    [festivals]
  );

  const today = new Date();
  const weekendStart = nextSaturday(today);
  const weekendEnd = nextSunday(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const weekendFrom = format(weekendStart, "yyyy-MM-dd");
  const weekendTo = format(weekendEnd, "yyyy-MM-dd");
  const monthFrom = format(monthStart, "yyyy-MM-dd");
  const monthTo = format(monthEnd, "yyyy-MM-dd");

  const currentFrom = searchParams.get("from");
  const currentTo = searchParams.get("to");
  const freeParam = searchParams.get("free");
  const freeActive = freeParam === null ? true : freeParam === "1" || freeParam === "true";

  const baseClearHref = `/map${serializeFilters(withDefaultFilters({}))}`;
  const popularCategoryChips = Array.from(new Set(festivalCategories)).slice(0, 5);

  const pushParams = (mutate: (params: URLSearchParams) => void) => {
    const current = new URLSearchParams(searchParams.toString());
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    paramsWithPageReset(next);

    const currentComparable = paramsWithPageReset(current).toString();
    const nextComparable = next.toString();

    if (currentComparable === nextComparable) {
      router.refresh();
      return;
    }

    const href = nextComparable ? `${pathname}?${nextComparable}` : pathname;
    router.push(href, { scroll: false });
  };

  const toggleFree = () => {
    pushParams((params) => {
      if (freeActive) {
        params.set("free", "0");
      } else {
        params.set("free", "1");
      }
    });
  };

  const toggleWeekend = () => {
    const active = currentFrom === weekendFrom && currentTo === weekendTo;
    pushParams((params) => {
      if (active) {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", weekendFrom);
        params.set("to", weekendTo);
      }
    });
  };

  const toggleMonth = () => {
    const active = currentFrom === monthFrom && currentTo === monthTo;
    pushParams((params) => {
      if (active) {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", monthFrom);
        params.set("to", monthTo);
      }
    });
  };

  const toggleCategory = (category: string) => {
    const current = (searchParams.get("cat") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const active = current.includes(category);

    pushParams((params) => {
      if (active) {
        const nextValues = current.filter((item) => item !== category);
        if (nextValues.length) {
          params.set("cat", nextValues.join(","));
        } else {
          params.delete("cat");
        }
      } else {
        params.set("cat", category);
      }
    });
  };

  const onNearMe = () => {
    if (!navigator.geolocation) {
      setGeoMessage(COPY.geoDenied);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoMessage(null);
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude, zoom: 11 };
        setFocusCoords(coords);

        if (searchParams.has("radius")) {
          pushParams((params) => {
            const currentRadius = params.get("radius");
            params.set("radius", currentRadius || "50");
          });
        }
      },
      () => setGeoMessage(COPY.geoDenied),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onResetFilters = () => {
    pushParams((params) => {
      FILTER_PARAM_KEYS.forEach((key) => params.delete(key));
    });
  };

  const onResetView = () => {
    setSelectedFestivalId(null);
    setFocusCoords(null);
    setResetViewToken((value) => value + 1);

    pushParams((params) => {
      params.delete("center");
      params.delete("zoom");
      params.delete("bounds");
    });
  };

  const onSelectFestival = (festival: Festival) => {
    setSelectedFestivalId(festival.id);
    if (festival.lat != null && festival.lng != null) {
      setFocusCoords({ lat: festival.lat, lng: festival.lng, zoom: 12 });
    }
  };

  return (
    <div className="landing-bg overflow-x-hidden text-[#0c0e14]">
      <Section className="overflow-x-clip bg-transparent pb-8 pt-8 md:pb-10 md:pt-10">
        <Container>
          <div className="space-y-6 lg:space-y-7">
            <div className="rounded-[28px] border border-black/[0.08] bg-white/75 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_12px_30px_rgba(12,14,20,0.08)] backdrop-blur md:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 md:gap-6">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/40">Festivo Explorer</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{COPY.title}</h1>
                  <p className="mt-3 text-sm text-black/65 md:text-[15px]">{COPY.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden lg:block xl:hidden">
                    <MapFiltersSheet initialFilters={filters} />
                  </div>
                  <ViewToggle active="/map" filters={filters} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
                <button
                  type="button"
                  onClick={toggleFree}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                    freeActive
                      ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                      : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  {COPY.free}
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
                  {COPY.weekend}
                </button>
                <button
                  type="button"
                  onClick={toggleMonth}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                    currentFrom === monthFrom && currentTo === monthTo
                      ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                      : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  {COPY.month}
                </button>
                {popularCategoryChips.map((category) => {
                  const active = filters.cat?.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleCategory(category)}
                      className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                        active
                          ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                          : "border-black/[0.1] bg-white/90 text-[#0c0e14] hover:border-black/20 hover:bg-white"
                      }`}
                    >
                      {festivalCategoryLabels[category] ?? category}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 xl:hidden">
              <MapSearchBar initialFilters={filters} />
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[23rem_minmax(0,1fr)]">
              <div className="hidden xl:block">
                <div className="sticky top-[84px] space-y-4">
                  <MapFiltersSidebar initialFilters={filters} className="max-w-none" />
                  <div className="rounded-2xl border border-black/[0.08] bg-white/80 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onNearMe}
                        className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                      >
                        {COPY.nearMe}
                      </button>
                      <button
                        type="button"
                        onClick={onResetView}
                        className="rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                      >
                        {COPY.resetView}
                      </button>
                      <button
                        type="button"
                        onClick={onResetFilters}
                        className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                      >
                        {COPY.resetFilters}
                      </button>
                    </div>
                    {geoMessage ? <p className="mt-3 text-xs text-[#b13a1a]">{geoMessage}</p> : null}
                  </div>
                  <div className="max-h-[calc(100vh-25rem)] overflow-y-auto rounded-2xl border border-black/[0.08] bg-white/80 p-3 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur">
                    <MapResultsList
                      festivals={festivals}
                      selectedFestivalId={selectedFestivalId}
                      onSelectFestival={onSelectFestival}
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.08] bg-white/80 px-4 py-3 shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_20px_rgba(12,14,20,0.07)] backdrop-blur">
                  <p className="text-sm font-semibold text-[#0c0e14]">
                    {COPY.mapCount}: {mapPoints.length} / {COPY.totalCount}: {total}
                  </p>
                  <div className="flex items-center gap-2 xl:hidden">
                    <button
                      type="button"
                      onClick={onNearMe}
                      className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                    >
                      {COPY.nearMe}
                    </button>
                    <button
                      type="button"
                      onClick={onResetView}
                      className="rounded-xl border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                    >
                      {COPY.resetView}
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white/80 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur xl:sticky xl:top-[84px]">
                  <div className="h-[58vh] min-h-[360px] md:h-[62vh] xl:h-[calc(100vh-10.5rem)]">
                    <MapViewClient
                      festivals={mapPoints}
                      selectedFestivalId={selectedFestivalId}
                      onSelectFestival={onSelectFestival}
                      focusCoords={focusCoords}
                      resetViewToken={resetViewToken}
                    />
                  </div>
                </div>

                <div className="hidden lg:block xl:hidden rounded-2xl border border-black/[0.08] bg-white/80 p-3 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur">
                  <details>
                    <summary className="cursor-pointer list-none rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25">
                      {COPY.results} ({festivals.length})
                    </summary>
                    <div className="mt-3 max-h-[50vh] overflow-y-auto">
                      <MapResultsList
                        festivals={festivals}
                        selectedFestivalId={selectedFestivalId}
                        onSelectFestival={onSelectFestival}
                      />
                    </div>
                  </details>
                </div>
              </div>
            </div>

            <div className="lg:hidden">
              <MapMobileResultsSheet count={festivals.length}>
                <MapResultsList
                  festivals={festivals}
                  selectedFestivalId={selectedFestivalId}
                  onSelectFestival={onSelectFestival}
                />
              </MapMobileResultsSheet>
              <div className="fixed bottom-5 right-4 z-30 flex flex-col gap-2">
                <MapFiltersSheet initialFilters={filters} floating />
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="rounded-full bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white shadow-[0_2px_0_rgba(12,14,20,0.05),0_8px_18px_rgba(12,14,20,0.08)] transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  {COPY.clear}
                </button>
              </div>
            </div>

            {festivals.length === 0 ? (
              <div className="rounded-2xl border border-black/[0.08] bg-white/80 px-6 py-10 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)]">
                <p className="text-base font-semibold text-[#0c0e14]">Няма фестивали по тези филтри.</p>
                <Link
                  href={baseClearHref}
                  scroll={false}
                  className="mt-4 inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-[#1d202b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
                >
                  {COPY.clear}
                </Link>
              </div>
            ) : null}
          </div>
        </Container>
      </Section>
    </div>
  );
}
