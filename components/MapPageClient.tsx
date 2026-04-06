"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import ViewToggle from "@/components/ViewToggle";
import MapFiltersSidebar from "@/components/MapFiltersSidebar";
import MapFiltersSheet from "@/components/MapFiltersSheet";
import MapViewClient from "@/components/MapViewClient";
import MapResultsList from "@/components/MapResultsList";
import MapMobileResultsSheet from "@/components/MapMobileResultsSheet";
import { serializeFilters, withDefaultFilters } from "@/lib/filters";
import { pub } from "@/lib/public-ui/styles";
import { Festival, Filters } from "@/lib/types";
import { cn } from "@/lib/utils";

type MapPageClientProps = {
  filters: Filters;
  festivals: Festival[];
  total: number;
  categoryOptions: string[];
};

type FocusCoords = {
  lat: number;
  lng: number;
  zoom?: number;
};

type UserCoords = {
  lat: number;
  lng: number;
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
  resetView: "Нулирай изгледа",
  clearFilters: "Изчисти филтрите",
  locationActive: "Показваме събития около теб",
  geoDenied: "Не можем да вземем локацията ти. Показваме ти популярни събития.",
};

const FILTER_PARAM_KEYS = ["city", "from", "to", "cat", "free", "sort", "month", "q", "search", "radius", "page"];

function parseUrlCoord(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function paramsWithPageReset(params: URLSearchParams) {
  params.delete("page");
  return params;
}

export default function MapPageClient({ filters, festivals, total, categoryOptions }: MapPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialUserCoords = useMemo(() => {
    const lat = parseUrlCoord(searchParams.get("userLat"));
    const lng = parseUrlCoord(searchParams.get("userLng"));
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [searchParams]);

  const [selectedFestivalId, setSelectedFestivalId] = useState<string | number | null>(null);
  const [focusCoords, setFocusCoords] = useState<FocusCoords | null>(
    initialUserCoords ? { ...initialUserCoords, zoom: 11 } : null
  );
  const [userCoords, setUserCoords] = useState<UserCoords | null>(initialUserCoords);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  const festivalsSortedByDistance = useMemo(() => {
    if (!userCoords) return festivals;

    const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const toRadians = (value: number) => (value * Math.PI) / 180;
      const earthRadiusKm = 6371;
      const dLat = toRadians(lat2 - lat1);
      const dLng = toRadians(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };

    return [...festivals].sort((a, b) => {
      const aHasCoords = a.lat != null && a.lng != null;
      const bHasCoords = b.lat != null && b.lng != null;

      if (!aHasCoords && !bHasCoords) return 0;
      if (!aHasCoords) return 1;
      if (!bHasCoords) return -1;

      const distanceA = distanceKm(userCoords.lat, userCoords.lng, a.lat as number, a.lng as number);
      const distanceB = distanceKm(userCoords.lat, userCoords.lng, b.lat as number, b.lng as number);
      return distanceA - distanceB;
    });
  }, [festivals, userCoords]);

  const mapPoints = useMemo(
    () => festivalsSortedByDistance.filter((festival) => festival.lat != null && festival.lng != null),
    [festivalsSortedByDistance]
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

  const onNearMe = () => {
    if (!navigator.geolocation) {
      setGeoMessage(COPY.geoDenied);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoMessage(null);
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude, zoom: 11 };
        setUserCoords({ lat: coords.lat, lng: coords.lng });
        setFocusCoords(coords);

        if (searchParams.has("radius")) {
          pushParams((params) => {
            const currentRadius = params.get("radius");
            params.set("radius", currentRadius || "50");
          });
        }
      },
      () => {
        setUserCoords(null);
        setGeoMessage(COPY.geoDenied);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onResetFilters = () => {
    pushParams((params) => {
      FILTER_PARAM_KEYS.forEach((key) => params.delete(key));
      params.set("free", "1");
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
    <div className={pub.pageOverflow}>
      <Section className={pub.sectionLoose}>
        <Container>
          <div className={pub.stackMd}>
            <div className={pub.panelHero}>
              <div className="flex flex-wrap items-start justify-between gap-4 md:gap-6">
                <div className="max-w-3xl">
                  <p className={pub.eyebrowMuted}>Festivo Explorer</p>
                  <h1 className={cn(pub.pageTitle, "mt-2")}>{COPY.title}</h1>
                  <p className={cn(pub.body, "mt-3")}>{COPY.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden lg:block xl:hidden">
                    <MapFiltersSheet
                      initialFilters={filters}
                      categoryOptions={categoryOptions}
                      onNearMe={onNearMe}
                    />
                  </div>
                  <ViewToggle active="/map" filters={filters} />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 md:mt-6">
                <button
                  type="button"
                  onClick={toggleFree}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                    pub.focusRing,
                    freeActive ? pub.toggleActive : pub.toggleInactive,
                  )}
                >
                  {COPY.free}
                </button>
                <button
                  type="button"
                  onClick={toggleWeekend}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                    pub.focusRing,
                    currentFrom === weekendFrom && currentTo === weekendTo ? pub.toggleActive : pub.toggleInactive,
                  )}
                >
                  {COPY.weekend}
                </button>
                <button
                  type="button"
                  onClick={toggleMonth}
                  className={cn(
                    "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition",
                    pub.focusRing,
                    currentFrom === monthFrom && currentTo === monthTo ? pub.toggleActive : pub.toggleInactive,
                  )}
                >
                  {COPY.month}
                </button>
              </div>
            </div>

            <div className="grid items-start gap-6 xl:grid-cols-[23rem_minmax(0,1fr)]">
              <div className="hidden xl:block">
                <div className="sticky top-[84px] space-y-4">
                  <MapFiltersSidebar
                    initialFilters={filters}
                    categoryOptions={categoryOptions}
                    onNearMe={onNearMe}
                    className="max-w-none"
                  />
                  {geoMessage ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-xs text-[#b13a1a]">{geoMessage}</p>
                  ) : null}
                  <div className={cn(pub.panelMuted, "max-h-[calc(100vh-25rem)] overflow-y-auto p-3")}>
                    <MapResultsList
                      festivals={festivalsSortedByDistance}
                      selectedFestivalId={selectedFestivalId}
                      onSelectFestival={onSelectFestival}
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-0 space-y-4">
                <div className={cn(pub.panelMuted, "flex flex-wrap items-center justify-between gap-3 px-4 py-3")}>
                  <p className="text-sm font-semibold text-[#0c0e14]">
                    {COPY.mapCount}: {mapPoints.length} / {COPY.totalCount}: {total}
                  </p>
                  <div className="flex items-center gap-2 xl:hidden">
                    <button
                      type="button"
                      onClick={onNearMe}
                      className={cn(pub.btnSecondarySm, "px-3 py-1.5 hover:bg-[#f7f6f3]", pub.focusRing)}
                    >
                      {COPY.nearMe}
                    </button>
                    <button
                      type="button"
                      onClick={onResetView}
                      className={cn(pub.btnSecondarySm, "px-3 py-1.5 hover:bg-[#f7f6f3]", pub.focusRing)}
                    >
                      {COPY.resetView}
                    </button>
                  </div>
                </div>

                <div
                  className={cn(
                    pub.panelMuted,
                    "overflow-hidden xl:sticky xl:top-[84px]",
                  )}
                >
                  {userCoords ? (
                    <div className="border-b border-black/[0.08] px-4 py-2.5 text-xs font-medium text-black/65">{COPY.locationActive}</div>
                  ) : null}
                  <div className="h-[58vh] min-h-[360px] md:h-[62vh] xl:h-[calc(100vh-10.5rem)]">
                    <MapViewClient
                      festivals={mapPoints}
                      selectedFestivalId={selectedFestivalId}
                      onSelectFestival={onSelectFestival}
                      focusCoords={focusCoords}
                      userCoords={userCoords}
                      resetViewToken={resetViewToken}
                    />
                  </div>
                </div>

                <div className={cn(pub.panelMuted, "hidden p-3 lg:block xl:hidden")}>
                  <details>
                    <summary
                      className={cn(
                        "cursor-pointer list-none rounded-xl border border-black/[0.1] bg-white px-4 py-2 text-sm font-semibold text-[#0c0e14]",
                        pub.focusRing,
                      )}
                    >
                      {COPY.results} ({festivals.length})
                    </summary>
                    <div className="mt-3 max-h-[50vh] overflow-y-auto">
                      <MapResultsList
                        festivals={festivalsSortedByDistance}
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
                  festivals={festivalsSortedByDistance}
                  selectedFestivalId={selectedFestivalId}
                  onSelectFestival={onSelectFestival}
                />
              </MapMobileResultsSheet>
              {geoMessage ? (
                <p className="mb-2 px-1 text-xs text-[#b13a1a]">{geoMessage}</p>
              ) : null}
              <div className="fixed bottom-5 right-4 z-30 flex flex-col gap-2">
                <MapFiltersSheet
                  initialFilters={filters}
                  categoryOptions={categoryOptions}
                  onNearMe={onNearMe}
                  floating
                />
                <button
                  type="button"
                  onClick={onResetFilters}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm",
                    pub.btnPrimarySm,
                    pub.focusRing,
                  )}
                >
                  {COPY.clearFilters}
                </button>
              </div>
            </div>

            {festivals.length === 0 ? (
              <div className={cn(pub.sectionCardSoft, "px-6 py-10 text-center")}>
                <p className="text-base font-semibold text-[#0c0e14]">Няма фестивали по тези филтри.</p>
                <Link
                  href={baseClearHref}
                  scroll={false}
                  className={cn("mt-4 inline-flex", pub.btnPrimarySm, pub.focusRing)}
                >
                  {COPY.clearFilters}
                </Link>
              </div>
            ) : null}
          </div>
        </Container>
      </Section>
    </div>
  );
}
