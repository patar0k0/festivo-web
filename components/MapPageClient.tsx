"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { endOfMonth, format, nextSaturday, nextSunday, startOfMonth } from "date-fns";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import ViewToggle from "@/components/ViewToggle";
import MapFiltersSheet from "@/components/MapFiltersSheet";
import MapViewClient from "@/components/MapViewClient";
import MapResultsList from "@/components/MapResultsList";
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
  free: "Безплатни",
  weekend: "Този уикенд",
  month: "Този месец",
  moreFilters: "Още филтри",
  results: "Резултати",
  mapCount: "На картата",
  totalCount: "Общо",
  nearMe: "До мен",
  resetView: "Нулирай изгледа",
  clearFilters: "Изчисти филтрите",
  locationActive: "Показваме събития около теб",
  geoDenied: "Не можем да вземем локацията ти. Показваме ти популярни събития.",
};

const FILTER_PARAM_KEYS = ["city", "from", "to", "cat", "free", "sort", "month", "when", "q", "search", "radius", "page"];

function parseUrlCoord(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function paramsWithPageReset(params: URLSearchParams) {
  params.delete("page");
  return params;
}

/**
 * Chip-style toggle button used in the sticky filter bar.
 *
 * Visual states:
 *   - default: neutral border, white bg
 *   - active:  brand red border + tint, brand text
 *
 * Single source of styling lives here so every chip stays consistent without
 * each call site re-creating the className. Pure presentational — caller
 * passes the active boolean + onClick.
 */
function FilterChip({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25",
        active
          ? "border-[#7c2d12] bg-[#7c2d12]/8 text-[#7c2d12] shadow-[inset_0_-1px_0_rgba(124,45,18,0.15)]"
          : "border-black/[0.12] bg-white text-black/70 hover:border-black/20 hover:bg-black/[0.03] hover:text-[#0c0e14]",
      )}
    >
      {children}
    </button>
  );
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

  // Initial map viewport from URL (lat/lng/zoom). Lets shareable links
  // restore the exact camera position. Read once on mount; subsequent
  // updates are written back via onViewportChange (debounced).
  const initialView = useMemo(() => {
    const lat = parseUrlCoord(searchParams.get("lat"));
    const lng = parseUrlCoord(searchParams.get("lng"));
    const zoom = parseUrlCoord(searchParams.get("zoom"));
    if (lat == null || lng == null || zoom == null) return null;
    return { lat, lng, zoom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedFestivalId, setSelectedFestivalId] = useState<string | number | null>(null);
  const [hoveredFestivalId, setHoveredFestivalId] = useState<string | number | null>(null);
  const [focusCoords, setFocusCoords] = useState<FocusCoords | null>(
    initialUserCoords ? { ...initialUserCoords, zoom: 11 } : null
  );
  const [userCoords, setUserCoords] = useState<UserCoords | null>(initialUserCoords);
  const [resetViewToken, setResetViewToken] = useState(0);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [boundsFilter, setBoundsFilter] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  // Mobile-only: tab between map and list. Default "map" because that's the
  // hero of /map. On lg+ both panes are shown side-by-side and this state is
  // ignored.
  const [mobileTab, setMobileTab] = useState<"map" | "list">("map");

  // Debounced URL writer for lat/lng/zoom. Without debounce, every pan
  // would trigger a router.replace which thrashes history.
  const viewportWriteRef = useRef<number | null>(null);
  const onViewportChange = useCallback(
    (view: { lat: number; lng: number; zoom: number }) => {
      if (viewportWriteRef.current !== null) {
        window.clearTimeout(viewportWriteRef.current);
      }
      viewportWriteRef.current = window.setTimeout(() => {
        viewportWriteRef.current = null;
        const params = new URLSearchParams(window.location.search);
        params.set("lat", view.lat.toFixed(4));
        params.set("lng", view.lng.toFixed(4));
        params.set("zoom", String(Math.round(view.zoom)));
        // history.replaceState keeps the URL in sync without adding entries —
        // Back button still returns to the page they came from, not every pan.
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
      }, 500);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (viewportWriteRef.current !== null) {
        window.clearTimeout(viewportWriteRef.current);
      }
    };
  }, []);

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

  // Филтрира списъка по текущите граници на картата след "Търси в тази зона"
  const festivalsForList = useMemo(() => {
    if (!boundsFilter) return festivalsSortedByDistance;
    return festivalsSortedByDistance.filter((f) => {
      const lat = f.lat as number | null;
      const lng = f.lng as number | null;
      if (lat == null || lng == null) return false;
      return (
        lat <= boundsFilter.north &&
        lat >= boundsFilter.south &&
        lng <= boundsFilter.east &&
        lng >= boundsFilter.west
      );
    });
  }, [festivalsSortedByDistance, boundsFilter]);

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
  // Phase 2 default: show ALL events first. Previously `free` defaulted to TRUE
  // when the URL param was absent — which silently hid paid events from anyone
  // landing on /map without explicit filters. That hurt discovery. Users who
  // want free-only now click the chip explicitly.
  const freeParam = searchParams.get("free");
  const freeActive = freeParam === "1" || freeParam === "true";

  const weekendActive = currentFrom === weekendFrom && currentTo === weekendTo;
  const monthActive = currentFrom === monthFrom && currentTo === monthTo;

  // Indicators that "more filters" sheet has applied options the chip bar
  // doesn't expose directly (city, category, sort, custom date range). Used
  // to badge the "Още филтри" chip so the user knows it's active.
  const advancedFiltersActive =
    Boolean(searchParams.get("city")) ||
    Boolean(searchParams.get("cat") || searchParams.get("tag")) ||
    Boolean(searchParams.get("sort")) ||
    (Boolean(currentFrom) && !weekendActive && !monthActive) ||
    (Boolean(currentTo) && !weekendActive && !monthActive);

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
        params.delete("free");
      } else {
        params.set("free", "1");
      }
    });
  };

  const toggleWeekend = () => {
    pushParams((params) => {
      if (weekendActive) {
        params.delete("from");
        params.delete("to");
      } else {
        params.set("from", weekendFrom);
        params.set("to", weekendTo);
      }
    });
  };

  const toggleMonth = () => {
    pushParams((params) => {
      if (monthActive) {
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
    setBoundsFilter(null);
    pushParams((params) => {
      FILTER_PARAM_KEYS.forEach((key) => params.delete(key));
    });
  };

  const onResetView = () => {
    setSelectedFestivalId(null);
    setFocusCoords(null);
    setBoundsFilter(null);
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

  const anyFiltersActive = freeActive || weekendActive || monthActive || advancedFiltersActive;

  return (
    <div className={pub.pageOverflow}>
      <Section className={pub.sectionLoose}>
        <Container>
          <div className={pub.stackMd}>
            {/* ── HERO ─────────────────────────────────────────── */}
            <div className={pub.panelHero}>
              <div className="flex flex-wrap items-start justify-between gap-4 md:gap-6">
                <div className="max-w-3xl">
                  <p className={pub.eyebrowMuted}>Festivo Explorer</p>
                  <h1 className={cn(pub.pageTitle, "mt-2")}>{COPY.title}</h1>
                  <p className={cn(pub.body, "mt-3")}>{COPY.subtitle}</p>
                </div>
                <ViewToggle active="/map" filters={filters} />
              </div>
            </div>

            {/* ── FILTER CHIP BAR (sticky) ────────────────────────
                Replaces the bulky 23rem sidebar with a single horizontal row
                of toggle chips. Heavy filtering options (city, category, sort,
                custom date range) move into the existing MapFiltersSheet,
                triggered by the "Още филтри" chip. */}
            <div
              className={cn(
                "sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b border-black/[0.06] bg-[#f5f4f0]/95 px-4 py-3 backdrop-blur md:-mx-0 md:rounded-2xl md:border md:border-amber-200/45 md:bg-white/85 md:px-4 md:py-3 md:shadow-sm",
              )}
              role="toolbar"
              aria-label="Филтри"
            >
              {/* "Още филтри" — opens existing sheet for city/category/sort/etc. */}
              <div className="relative">
                <MapFiltersSheet
                  initialFilters={filters}
                  categoryOptions={categoryOptions}
                  onNearMe={onNearMe}
                />
                {advancedFiltersActive ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#7c2d12] ring-2 ring-white"
                  />
                ) : null}
              </div>

              <FilterChip active={freeActive} onClick={toggleFree}>
                🆓 {COPY.free}
              </FilterChip>
              <FilterChip active={weekendActive} onClick={toggleWeekend}>
                📅 {COPY.weekend}
              </FilterChip>
              <FilterChip active={monthActive} onClick={toggleMonth}>
                📅 {COPY.month}
              </FilterChip>

              <FilterChip active={Boolean(userCoords)} onClick={onNearMe} ariaLabel="Покажи фестивали около мен">
                📍 {COPY.nearMe}
              </FilterChip>

              {/* Spacer pushes "Clear" to the right on wide screens */}
              <div className="ml-auto flex items-center gap-2">
                <p className="hidden text-xs text-black/55 sm:block">
                  {COPY.mapCount}: <span className="font-semibold text-[#0c0e14]">{mapPoints.length}</span>
                  <span className="mx-1.5 text-black/30">·</span>
                  {COPY.totalCount}: <span className="font-semibold text-[#0c0e14]">{total}</span>
                </p>
                {anyFiltersActive ? (
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className={cn(
                      "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-black/55 transition hover:bg-black/[0.05] hover:text-[#0c0e14]",
                      pub.focusRing,
                    )}
                  >
                    ↻ {COPY.clearFilters}
                  </button>
                ) : null}
              </div>
            </div>

            {geoMessage ? (
              <p className="rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-xs text-[#b13a1a]">{geoMessage}</p>
            ) : null}

            {/* ── Mobile/tablet tab toggle (< lg) ──────────────
                Single full-width tabs row above the active pane. Avoids the
                "where did the list go?" confusion of bottom-sheet patterns —
                explicit toggle is more discoverable for casual users. */}
            <div className="flex rounded-full border border-black/[0.1] bg-white p-1 lg:hidden" role="tablist" aria-label="Изглед">
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === "map"}
                onClick={() => setMobileTab("map")}
                className={cn(
                  "flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition",
                  mobileTab === "map"
                    ? "bg-[#7c2d12] text-white shadow-sm"
                    : "text-black/65 hover:text-[#0c0e14]",
                )}
              >
                📍 Карта
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileTab === "list"}
                onClick={() => setMobileTab("list")}
                className={cn(
                  "flex-1 rounded-full px-4 py-1.5 text-xs font-semibold transition",
                  mobileTab === "list"
                    ? "bg-[#7c2d12] text-white shadow-sm"
                    : "text-black/65 hover:text-[#0c0e14]",
                )}
              >
                📋 Списък ({festivals.length})
              </button>
            </div>

            {/* ── 2-COLUMN LAYOUT (xl+): list left (40%) / map right (60%, sticky)
                On lg: same split. On <lg: only the active mobile tab is shown. */}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              {/* ── List column ──────────── */}
              <div className={cn(mobileTab === "list" ? "block" : "hidden", "lg:block")}>
                <div className={cn(pub.panelMuted, "max-h-[calc(100vh-10.5rem)] overflow-y-auto p-3")}>
                  <MapResultsList
                    festivals={festivalsForList}
                    selectedFestivalId={selectedFestivalId}
                    hoveredFestivalId={hoveredFestivalId}
                    onSelectFestival={onSelectFestival}
                    onHoverFestival={setHoveredFestivalId}
                  />
                </div>
              </div>

              {/* ── Map column ──────────── */}
              <div className={cn(mobileTab === "map" ? "block" : "hidden", "min-w-0 space-y-4 lg:block")}>
                {userCoords ? (
                  <p className="rounded-xl border border-amber-200/45 bg-amber-50/40 px-4 py-2 text-xs font-medium text-[#5c200d]">
                    {COPY.locationActive}
                  </p>
                ) : null}

                <div className={cn(pub.panelMuted, "relative overflow-hidden lg:sticky lg:top-[84px]")}>
                  <div className="h-[58vh] min-h-[360px] md:h-[62vh] lg:h-[calc(100vh-10.5rem)]">
                    <MapViewClient
                      festivals={mapPoints}
                      selectedFestivalId={selectedFestivalId}
                      hoveredFestivalId={hoveredFestivalId}
                      onSelectFestival={onSelectFestival}
                      onViewportChange={onViewportChange}
                      onSearchInBounds={setBoundsFilter}
                      initialView={initialView}
                      focusCoords={focusCoords}
                      userCoords={userCoords}
                      resetViewToken={resetViewToken}
                    />
                  </div>

                  {/* Reset-view floating control on the map itself, top-right.
                      Keeps Map area self-contained — no separate header strip
                      taking vertical space above. */}
                  {focusCoords || selectedFestivalId ? (
                    <button
                      type="button"
                      onClick={onResetView}
                      className="absolute right-3 top-3 z-[400] inline-flex items-center gap-1 rounded-full border border-black/[0.12] bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#0c0e14] shadow-sm transition hover:bg-white"
                      aria-label={COPY.resetView}
                    >
                      ↺ {COPY.resetView}
                    </button>
                  ) : null}
                </div>
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
