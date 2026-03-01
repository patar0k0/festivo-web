"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Festival } from "@/lib/types";

const icon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const COPY = {
  noPoints: "\u041d\u044f\u043c\u0430 \u043a\u043e\u043e\u0440\u0434\u0438\u043d\u0430\u0442\u0438 \u0437\u0430 \u043f\u043e\u043a\u0430\u0437\u0432\u0430\u043d\u0435 \u043d\u0430 \u043a\u0430\u0440\u0442\u0430\u0442\u0430",
  searchArea: "\u0422\u044a\u0440\u0441\u0438 \u0432 \u0442\u0430\u0437\u0438 \u0437\u043e\u043d\u0430",
  details: "\u0414\u0435\u0442\u0430\u0439\u043b\u0438",
  preview: "\u0412\u0438\u0436",
  fallbackCity: "\u0411\u044a\u043b\u0433\u0430\u0440\u0438\u044f",
};

export default function MapView({ festivals }: { festivals: Festival[] }) {
  const [hasMoved, setHasMoved] = useState(false);
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const points = useMemo(() => festivals.filter((festival) => festival.lat != null && festival.lng != null), [festivals]);
  const selectedFestival = useMemo(
    () => points.find((festival) => String(festival.id) === String(selectedId)) ?? null,
    [points, selectedId]
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

  if (!points.length) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl bg-[#f1efe8]">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">{COPY.noPoints}</span>
      </div>
    );
  }

  const center = [points[0].lat ?? 42.6977, points[0].lng ?? 23.3219] as [number, number];

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-xl">
      <MapContainer center={center} zoom={7} className="h-full w-full" whenReady={() => setHasMoved(false)}>
        <MapMoveWatcher onMove={() => setHasMoved(true)} />
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((festival) => (
          <Marker
            key={festival.id}
            position={[festival.lat ?? 0, festival.lng ?? 0]}
            icon={icon}
            eventHandlers={{ click: () => setSelectedId(festival.id) }}
          >
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{festival.title}</p>
                <p className="text-xs text-muted">{festival.city}</p>
                <Link href={`/festival/${festival.slug}`} className="text-xs font-semibold text-ink">
                  {COPY.preview}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {hasMoved ? (
        <button
          className="absolute left-1/2 top-4 z-[500] -translate-x-1/2 rounded-full bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-[0_10px_24px_rgba(12,14,20,0.22)]"
          onClick={() => setHasMoved(false)}
          type="button"
        >
          {COPY.searchArea}
        </button>
      ) : null}
      {selectedFestival ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-[500]">
          <div className="pointer-events-auto rounded-xl border border-black/[0.08] bg-white/95 p-3 shadow-[0_2px_0_rgba(12,14,20,0.06),0_14px_30px_rgba(12,14,20,0.16)] backdrop-blur">
            <p className="text-sm font-semibold text-[#0c0e14]">{selectedFestival.title}</p>
            <p className="mt-0.5 text-xs text-black/60">{selectedFestival.city ?? COPY.fallbackCity}</p>
            <Link
              href={`/festival/${selectedFestival.slug}`}
              className="mt-2 inline-flex rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
            >
              {COPY.details}
            </Link>
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
