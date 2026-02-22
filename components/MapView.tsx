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

export default function MapView({ festivals }: { festivals: Festival[] }) {
  const [hasMoved, setHasMoved] = useState(false);
  const points = useMemo(() => festivals.filter((festival) => festival.lat && festival.lng), [festivals]);

  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  if (!points.length) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl bg-sand">
        <span className="text-xs uppercase tracking-widest text-muted">Map data coming soon</span>
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
          >
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{festival.title}</p>
                <p className="text-xs text-muted">{festival.city}</p>
                <Link href={`/festival/${festival.slug}`} className="text-xs font-semibold text-ink">
                  View details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {hasMoved && (
        <button
          className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
          onClick={() => setHasMoved(false)}
        >
          Search this area
        </button>
      )}
    </div>
  );
}

function MapMoveWatcher({ onMove }: { onMove: () => void }) {
  useMapEvents({
    moveend: () => onMove(),
  });
  return null;
}
