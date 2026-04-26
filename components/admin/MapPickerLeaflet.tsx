"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
};

export default function MapPickerLeaflet({ center, zoom, marker, onMapClick, onMarkerDragEnd }: MapPickerLeafletProps) {
  useEffect(() => {
    const defaultIcon = L.Icon.Default as typeof L.Icon.Default & { prototype: { _getIconUrl?: () => string } };
    delete defaultIcon.prototype._getIconUrl;
    defaultIcon.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  return (
    <MapContainer center={center} zoom={zoom} className="z-0 h-[min(360px,50vh)] w-full rounded-lg" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapClickLayer onClick={onMapClick} />
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
