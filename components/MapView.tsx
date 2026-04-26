"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import PlanFestivalBookmark from "@/components/plan/PlanFestivalBookmark";
import { festivalProgrammeHref } from "@/lib/festival/programmeAnchor";
import { formatFestivalDateLineShort } from "@/lib/festival/listingDates";
import { getFestivalListingCityPrimary } from "@/lib/settlements/getCityLabel";
import { Festival } from "@/lib/types";

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
  onSelectFestival: (festival: Festival) => void;
  focusCoords: FocusCoords | null;
  userCoords: UserCoords | null;
  resetViewToken: number;
};

const DEFAULT_CENTER: [number, number] = [42.6977, 23.3219];
const DEFAULT_ZOOM = 7;

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const userIcon = L.divIcon({
  html: '<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#2d7dff;border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(45,125,255,0.35);"></span>',
  className: "festivo-user-location-marker",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export default function MapView({
  festivals,
  selectedFestivalId,
  onSelectFestival,
  focusCoords,
  userCoords,
  resetViewToken,
}: MapViewProps) {
  const [hasMoved, setHasMoved] = useState(false);
  const selectedFestival = useMemo(
    () => festivals.find((festival) => String(festival.id) === String(selectedFestivalId)) ?? null,
    [festivals, selectedFestivalId]
  );

  useEffect(() => {
    const defaultIcon = L.Icon.Default as typeof L.Icon.Default & {
      prototype: { _getIconUrl?: () => string };
    };
    delete defaultIcon.prototype._getIconUrl;
    defaultIcon.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  if (!festivals.length) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl bg-[#f1efe8]">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
          Няма координати за показване на картата
        </span>
      </div>
    );
  }

  const center = [festivals[0].lat ?? DEFAULT_CENTER[0], festivals[0].lng ?? DEFAULT_CENTER[1]] as [number, number];

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-xl">
      <MapContainer center={center} zoom={DEFAULT_ZOOM} className="h-full w-full" whenReady={() => setHasMoved(false)}>
        <MapMoveWatcher onMove={() => setHasMoved(true)} />
        <MapViewportController focusCoords={focusCoords} resetViewToken={resetViewToken} />
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {festivals.map((festival) => (
          <Marker
            key={festival.id}
            position={[festival.lat ?? 0, festival.lng ?? 0]}
            icon={icon}
            eventHandlers={{
              click: () => onSelectFestival(festival),
            }}
          >
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{festival.title}</p>
                <p className="text-xs text-muted">{getFestivalListingCityPrimary(festival)}</p>
                <p className="text-xs text-muted">{formatFestivalDateLineShort(festival)}</p>
                <Link href={`/festivals/${festival.slug}`} className="text-xs font-semibold text-ink">
                  Виж
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
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
            <p className="mt-0.5 text-xs text-black/60">{getFestivalListingCityPrimary(selectedFestival)}</p>
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
                programmeHref={festivalProgrammeHref(`/festivals/${selectedFestival.slug}`)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MapMoveWatcher({ onMove }: { onMove: () => void }) {
  useMapEvents({
    moveend: () => onMove(),
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

