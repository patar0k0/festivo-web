"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
// Marker clustering — wraps groups of nearby pins into a single count bubble
// when zoomed out. Avoids pin-soup at country level; expands to individual
// pins on zoom-in. Uses leaflet.markercluster under the hood (peer dep
// installed with --legacy-peer-deps; react-leaflet 4 compat).
import MarkerClusterGroup from "react-leaflet-cluster";
import PlanFestivalBookmark from "@/components/plan/PlanFestivalBookmark";
import { festivalProgrammeHref } from "@/lib/festival/programmeAnchor";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import { Festival } from "@/lib/types";

// ── Branded festival pin (replaces Leaflet's default blue droplet) ─────────
//
// Custom divIcon = HTML/CSS pin in brand red (#7c2d12). Three states:
//   • normal  — drop shape with inner white dot
//   • hovered — same drop, slightly darker, no ring (light affordance only)
//   • selected — enlarged with animated pulse ring
const PIN_NORMAL_HTML = `
<div class="festivo-pin">
  <span class="festivo-pin__drop"></span>
  <span class="festivo-pin__dot"></span>
</div>`;

const PIN_HOVERED_HTML = `
<div class="festivo-pin festivo-pin--hovered">
  <span class="festivo-pin__drop"></span>
  <span class="festivo-pin__dot"></span>
</div>`;

const PIN_SELECTED_HTML = `
<div class="festivo-pin festivo-pin--selected">
  <span class="festivo-pin__ring"></span>
  <span class="festivo-pin__drop"></span>
  <span class="festivo-pin__dot"></span>
</div>`;

const festivalIcon = L.divIcon({
  html: PIN_NORMAL_HTML,
  className: "festivo-pin-wrap",
  iconSize: [28, 36],
  iconAnchor: [14, 34],
  popupAnchor: [0, -32],
});

const festivalIconHovered = L.divIcon({
  html: PIN_HOVERED_HTML,
  className: "festivo-pin-wrap festivo-pin-wrap--hovered",
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -34],
});

const festivalIconSelected = L.divIcon({
  html: PIN_SELECTED_HTML,
  className: "festivo-pin-wrap festivo-pin-wrap--selected",
  iconSize: [32, 40],
  iconAnchor: [16, 38],
  popupAnchor: [0, -36],
});

// Branded cluster icon — circle in brand red with count, sized by member
// count for visual weight. Pure divIcon HTML + CSS, no extra assets.
function clusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount();
  const sizeClass = count < 10 ? "sm" : count < 50 ? "md" : "lg";
  return L.divIcon({
    html: `<div class="festivo-cluster festivo-cluster--${sizeClass}"><span>${count}</span></div>`,
    className: "festivo-cluster-wrap",
    iconSize: [40, 40],
  });
}

type FocusCoords = {
  lat: number;
  lng: number;
  zoom?: number;
};

type UserCoords = {
  lat: number;
  lng: number;
};

type MapViewProps = {
  festivals: Festival[];
  selectedFestivalId: string | number | null;
  hoveredFestivalId: string | number | null;
  onSelectFestival: (festival: Festival) => void;
  /** Called after every map move/zoom end with the new view state. Caller can
   *  use this to persist lat/lng/zoom into the URL for shareable links. */
  onViewportChange?: (view: { lat: number; lng: number; zoom: number }) => void;
  /** Initial center + zoom; if omitted we centre on first festival or Bulgaria. */
  initialView?: { lat: number; lng: number; zoom: number } | null;
  focusCoords: FocusCoords | null;
  userCoords: UserCoords | null;
  resetViewToken: number;
};

const DEFAULT_CENTER: [number, number] = [42.6977, 23.3219];
const DEFAULT_ZOOM = 7;

// User location pin — blue dot (different colour from festival pins so it
// stands out at a glance: brand red = events, blue = "you are here").
const userIcon = L.divIcon({
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#2d7dff;border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(45,125,255,0.35);"></span>',
  className: "festivo-user-location-marker",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function pickIcon(isSelected: boolean, isHovered: boolean): L.DivIcon {
  if (isSelected) return festivalIconSelected;
  if (isHovered) return festivalIconHovered;
  return festivalIcon;
}

export default function MapView({
  festivals,
  selectedFestivalId,
  hoveredFestivalId,
  onSelectFestival,
  onViewportChange,
  initialView,
  focusCoords,
  userCoords,
  resetViewToken,
}: MapViewProps) {
  const [hasMoved, setHasMoved] = useState(false);
  const selectedFestival = useMemo(
    () => festivals.find((festival) => String(festival.id) === String(selectedFestivalId)) ?? null,
    [festivals, selectedFestivalId]
  );

  if (!festivals.length) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl bg-[#f1efe8]">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
          Няма координати за показване на картата
        </span>
      </div>
    );
  }

  const initialCenter: [number, number] = initialView
    ? [initialView.lat, initialView.lng]
    : [
        Number(festivals[0].latitude ?? festivals[0].lat ?? DEFAULT_CENTER[0]),
        Number(festivals[0].longitude ?? festivals[0].lng ?? DEFAULT_CENTER[1]),
      ];
  const initialZoom = initialView?.zoom ?? DEFAULT_ZOOM;

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-xl">
      <MapContainer center={initialCenter} zoom={initialZoom} className="h-full w-full" whenReady={() => setHasMoved(false)}>
        <MapMoveWatcher
          onMove={() => setHasMoved(true)}
          onViewportChange={onViewportChange}
        />
        <MapViewportController focusCoords={focusCoords} resetViewToken={resetViewToken} />
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          detectRetina
        />
        {/* MarkerClusterGroup wraps the pins so leaflet.markercluster groups
            nearby ones at low zoom. Selected pin is hoisted via zIndexOffset
            and stays prominent even inside a cluster's expanded view. */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={clusterIcon}
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {festivals.map((festival) => {
            const isSelected = String(festival.id) === String(selectedFestivalId);
            const isHovered = !isSelected && String(festival.id) === String(hoveredFestivalId);
            return (
              <Marker
                key={festival.id}
                position={[
                  Number(festival.latitude ?? festival.lat ?? 0),
                  Number(festival.longitude ?? festival.lng ?? 0),
                ]}
                icon={pickIcon(isSelected, isHovered)}
                eventHandlers={{
                  click: () => onSelectFestival(festival),
                }}
                zIndexOffset={isSelected ? 1000 : isHovered ? 500 : 0}
              />
            );
          })}
        </MarkerClusterGroup>
        {userCoords ? (
          <Marker position={[userCoords.lat, userCoords.lng]} icon={userIcon}>
            <Popup>
              <p className="text-sm font-semibold">Ти си тук</p>
            </Popup>
          </Marker>
        ) : null}
      </MapContainer>
      {hasMoved ? (
        <button
          className="absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(12,14,20,0.22)]"
          onClick={() => setHasMoved(false)}
          type="button"
        >
          Търси в тази зона
        </button>
      ) : null}
      {selectedFestival ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500]">
          <div className="pointer-events-auto rounded-xl border border-black/[0.08] bg-white/95 p-3 shadow-[0_2px_0_rgba(12,14,20,0.06),0_14px_30px_rgba(12,14,20,0.16)] backdrop-blur">
            <p className="text-sm font-semibold text-[#0c0e14]">{selectedFestival.title}</p>
            <p className="mt-0.5 text-xs text-black/60">{getFestivalLocationDisplay(selectedFestival).city ?? ""}</p>
            <p className="text-xs text-black/55">{formatFestivalDateLineShort(selectedFestival)}</p>
            <Link
              href={`/festivals/${selectedFestival.slug}`}
              className="mt-2 inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
            >
              Детайли
            </Link>
            <div className="mt-2">
              <PlanFestivalBookmark
                festivalId={String(selectedFestival.id)}
                festival={selectedFestival}
                programmeHref={festivalProgrammeHref(`/festivals/${selectedFestival.slug}`)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MapMoveWatcher({
  onMove,
  onViewportChange,
}: {
  onMove: () => void;
  onViewportChange?: (view: { lat: number; lng: number; zoom: number }) => void;
}) {
  useMapEvents({
    moveend: (e) => {
      onMove();
      if (onViewportChange) {
        const c = e.target.getCenter();
        onViewportChange({ lat: c.lat, lng: c.lng, zoom: e.target.getZoom() });
      }
    },
    zoomend: (e) => {
      if (onViewportChange) {
        const c = e.target.getCenter();
        onViewportChange({ lat: c.lat, lng: c.lng, zoom: e.target.getZoom() });
      }
    },
  });
  return null;
}

function MapViewportController({ focusCoords, resetViewToken }: { focusCoords: FocusCoords | null; resetViewToken: number }) {
  const map = useMap();

  useEffect(() => {
    if (!focusCoords) return;
    map.setView([focusCoords.lat, focusCoords.lng], focusCoords.zoom ?? 12, { animate: true });
  }, [focusCoords, map]);

  useEffect(() => {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true });
  }, [map, resetViewToken]);

  return null;
}
