"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const MapPickerLeaflet = dynamic(() => import("./MapPickerLeaflet"), { ssr: false });

/** Approximate geographic center of Bulgaria (fallback when no coords). */
export const BULGARIA_MAP_CENTER: [number, number] = [42.7339, 25.4858];

export type MapPickerModalProps = {
  open: boolean;
  onClose: () => void;
  initialLat: number | null | undefined;
  initialLng: number | null | undefined;
  onConfirm: (coords: { lat: number; lng: number }) => void;
};

export function MapPickerModal({ open, onClose, initialLat, initialLng, onConfirm }: MapPickerModalProps) {
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const lat = typeof initialLat === "number" ? initialLat : Number(initialLat);
    const lng = typeof initialLng === "number" ? initialLng : Number(initialLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setDraft({ lat, lng });
    } else {
      setDraft(null);
    }
  }, [open, initialLat, initialLng]);

  if (!open) return null;

  const hasInitialPoint = Number.isFinite(Number(initialLat)) && Number.isFinite(Number(initialLng));
  const center: [number, number] = draft
    ? [draft.lat, draft.lng]
    : hasInitialPoint
      ? [Number(initialLat), Number(initialLng)]
      : BULGARIA_MAP_CENTER;
  const zoom = draft || hasInitialPoint ? 13 : 7;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl">
        <h2 id="map-picker-title" className="text-sm font-semibold text-[#0c0e14]">
          Избор на координати
        </h2>
        <p className="mt-1 text-xs text-black/55">Кликнете върху картата или преместете маркера. OpenStreetMap.</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.08]">
          <MapPickerLeaflet
            center={center}
            zoom={zoom}
            marker={draft}
            onMapClick={(lat, lng) => setDraft({ lat, lng })}
            onMarkerDragEnd={(lat, lng) => setDraft({ lat, lng })}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-black/80"
          >
            Отказ
          </button>
          <button
            type="button"
            disabled={!draft}
            onClick={() => {
              if (draft) onConfirm(draft);
            }}
            className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            Потвърди
          </button>
        </div>
      </div>
    </div>
  );
}
