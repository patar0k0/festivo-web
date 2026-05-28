"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const markerIcon = new L.Icon({
  iconUrl: "/leaflet/marker-icon.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapClickLayer({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export type MapPickerLeafletProps = {
  center: [number, number];
  zoom: number;
  marker: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
  onMarkerDragEnd: (lat: number, lng: number) => void;
  /** When set, map flies to this position (zoom 14). Changes trigger a flyTo. */
  flyTo?: { lat: number; lng: number } | null;
};

/** Programmatically flies the map to `flyTo` whenever it changes. */
function FlyToController({ flyTo }: { flyTo: { lat: number; lng: number } | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (!flyTo) return;
    map.flyTo([flyTo.lat, flyTo.lng], 14, { animate: true });
  }, [flyTo, map]);
  return null;
}

export default function MapPickerLeaflet({ center, zoom, marker, onMapClick, onMarkerDragEnd, flyTo }: MapPickerLeafletProps) {
  useEffect(() => {
    const defaultIcon = L.Icon.Default as typeof L.Icon.Default & { prototype: { _getIconUrl?: () => string } };
    delete defaultIcon.prototype._getIconUrl;
    defaultIcon.mergeOptions({
      iconUrl: "/leaflet/marker-icon.png",
      shadowUrl: "/leaflet/marker-shadow.png",
    });
  }, []);

  return (
    <MapContainer center={center} zoom={zoom} className="z-0 h-[min(360px,50vh)] w-full rounded-lg" scrollWheelZoom>
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        detectRetina
      />
      <MapClickLayer onClick={onMapClick} />
      <FlyToController flyTo={flyTo} />
      {marker ? (
        <Marker
          position={[marker.lat, marker.lng]}
          draggable
          icon={markerIcon}
          eventHandlers={{
            dragend: (e) => {
              const p = e.target.getLatLng();
              onMarkerDragEnd(p.lat, p.lng);
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
