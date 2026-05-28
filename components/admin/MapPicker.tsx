"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GeoDebugStep } from "@/lib/location/geocodeLocation";

const MapPickerLeaflet = dynamic(() => import("./MapPickerLeaflet"), { ssr: false });

/** Approximate geographic center of Bulgaria (fallback when no coords). */
export const BULGARIA_MAP_CENTER: [number, number] = [42.7339, 25.4858];

export type MapPickerModalProps = {
  open: boolean;
  onClose: () => void;
  initialLat: number | null | undefined;
  initialLng: number | null | undefined;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  /** Pre-fills the search box (e.g. venue name). */
  locationName?: string | null;
  /** Pre-fills the search box alongside locationName (e.g. city). */
  cityName?: string | null;
};

function buildDefaultSearch(locationName?: string | null, cityName?: string | null): string {
  return [locationName, cityName].filter(Boolean).join(", ");
}

type SearchPayload = {
  ok?: boolean;
  lat?: number | null;
  lng?: number | null;
  query_used?: string | null;
  debug_steps?: GeoDebugStep[];
  google_key_configured?: boolean;
  error?: string;
};

/** Small row in the debug steps panel. */
function StepRow({ step }: { step: GeoDebugStep }) {
  if (step.skipped) {
    return (
      <li className="flex items-start gap-2 text-xs text-black/35">
        <span className="mt-px shrink-0 font-mono">—</span>
        <span>
          <span className="font-medium">{step.label}</span>
          {step.resultName ? <span className="ml-1 text-black/30">({step.resultName})</span> : null}
        </span>
      </li>
    );
  }
  if (step.ok) {
    return (
      <li className="flex items-start gap-2 text-xs text-emerald-700">
        <span className="mt-px shrink-0">✓</span>
        <span>
          <span className="font-medium">{step.label}</span>
          {step.resultName ? <span className="ml-1 font-normal text-emerald-600">→ {step.resultName}</span> : null}
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-start gap-2 text-xs text-red-500">
      <span className="mt-px shrink-0">✗</span>
      <span className="font-medium">{step.label}</span>
    </li>
  );
}

export function MapPickerModal({
  open,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
  locationName,
  cityName,
}: MapPickerModalProps) {
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [debugSteps, setDebugSteps] = useState<GeoDebugStep[] | null>(null);
  const [googleKeyConfigured, setGoogleKeyConfigured] = useState<boolean | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const lat = typeof initialLat === "number" ? initialLat : Number(initialLat);
    const lng = typeof initialLng === "number" ? initialLng : Number(initialLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      setDraft({ lat, lng });
    } else {
      setDraft(null);
    }
    setFlyTo(null);
    setSearchQuery(buildDefaultSearch(locationName, cityName));
    setSearchResult(null);
    setSearchError(null);
    setDebugSteps(null);
    setGoogleKeyConfigured(null);
    setShowDebug(false);
  }, [open, initialLat, initialLng, locationName, cityName]);

  if (!open) return null;

  const hasInitialPoint = Number.isFinite(Number(initialLat)) && Number.isFinite(Number(initialLng));
  const center: [number, number] = draft
    ? [draft.lat, draft.lng]
    : hasInitialPoint
      ? [Number(initialLat), Number(initialLng)]
      : BULGARIA_MAP_CENTER;
  const zoom = draft || hasInitialPoint ? 13 : 7;

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    setDebugSteps(null);
    setShowDebug(false);
    try {
      const res = await fetch("/api/admin/geocode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_name: query, direct_search: true }),
      });
      const payload = (await res.json().catch(() => null)) as SearchPayload | null;

      // Always store debug info if present
      if (Array.isArray(payload?.debug_steps)) {
        setDebugSteps(payload!.debug_steps);
      }
      if (typeof payload?.google_key_configured === "boolean") {
        setGoogleKeyConfigured(payload!.google_key_configured);
      }

      if (!res.ok || !payload?.ok) {
        setSearchError("Грешка при търсене. Провери връзката.");
        setShowDebug(true);
        return;
      }
      if (typeof payload.lat === "number" && typeof payload.lng === "number") {
        const found = { lat: payload.lat, lng: payload.lng };
        setDraft(found);
        setFlyTo(found);
        setSearchResult(payload.query_used ?? query);
      } else {
        setSearchError("Не намерихме тази локация. Опитай по-конкретно.");
        setShowDebug(true);
      }
    } catch {
      setSearchError("Грешка при търсене. Провери връзката.");
      setShowDebug(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

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
        <p className="mt-1 text-xs text-black/55">Търсете локация или кликнете директно върху картата.</p>

        {/* Search bar */}
        <div className="mt-3 flex gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setDebugSteps(null);
              setSearchResult(null);
              setSearchError(null);
              setShowDebug(false);
            }}
            onKeyDown={handleSearchKeyDown}
            placeholder="напр. площад Игор Юруков, Девин"
            disabled={searching}
            className="min-w-0 flex-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs text-[#0c0e14] placeholder:text-black/35 focus:outline-none focus:ring-2 focus:ring-[#0c0e14]/20 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="rounded-lg bg-[#0c0e14] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {searching ? "Търси..." : "Търси"}
          </button>
        </div>

        {/* Search feedback */}
        {searchResult ? (
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-emerald-700">
              ✓ Намерено: <span className="font-medium">{searchResult}</span>
            </p>
            {debugSteps ? (
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="text-[10px] text-black/35 underline underline-offset-2 hover:text-black/60"
              >
                {showDebug ? "скрий детайли" : "детайли"}
              </button>
            ) : null}
          </div>
        ) : searchError ? (
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-xs text-red-600">{searchError}</p>
            {debugSteps ? (
              <button
                type="button"
                onClick={() => setShowDebug((v) => !v)}
                className="text-[10px] text-black/35 underline underline-offset-2 hover:text-black/60"
              >
                {showDebug ? "скрий детайли" : "покажи защо"}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Debug steps panel */}
        {showDebug && debugSteps ? (
          <div className="mt-2 rounded-lg border border-black/[0.08] bg-black/[0.02] px-3 py-2">
            {googleKeyConfigured !== null ? (
              <p className={`mb-1.5 text-[10px] font-semibold ${googleKeyConfigured ? "text-emerald-700" : "text-amber-600"}`}>
                🔑 Google API ключ:{" "}
                {googleKeyConfigured ? "✓ конфигуриран" : "✗ не е конфигуриран — ползва се само OSM"}
              </p>
            ) : null}
            <ul className="space-y-1">
              {debugSteps.map((step, i) => (
                <StepRow key={i} step={step} />
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-3 overflow-hidden rounded-xl border border-black/[0.08]">
          <MapPickerLeaflet
            center={center}
            zoom={zoom}
            marker={draft}
            flyTo={flyTo}
            onMapClick={(lat, lng) => {
              setDraft({ lat, lng });
              setSearchResult(null);
            }}
            onMarkerDragEnd={(lat, lng) => setDraft({ lat, lng })}
          />
        </div>

        {draft ? (
          <p className="mt-2 text-xs text-black/45">
            Координати: {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
          </p>
        ) : (
          <p className="mt-2 text-xs text-black/35">Кликнете върху картата за да поставите маркер.</p>
        )}

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
