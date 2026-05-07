import { getFestivalLocationDisplay } from "@/lib/location/getFestivalLocationDisplay";
import { Festival } from "@/lib/types";
import { buildGoogleMapsUrl } from "@/lib/location/buildGoogleMapsUrl";

export default function FestivalLocation({ festival }: { festival: Festival }) {
  const loc = getFestivalLocationDisplay(festival);
  if (!loc.title && !loc.city) return null;
  const mapUrl = buildGoogleMapsUrl({
    placeId: festival.place_id,
    latitude: festival.latitude ?? festival.lat ?? undefined,
    longitude: festival.longitude ?? festival.lng ?? undefined,
  });

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Къде</h2>
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
          <div className="space-y-1 text-sm text-muted">
            {loc.title ? <p className="font-medium text-ink/90">{loc.title}</p> : null}
            {loc.city ? <p className={loc.title ? "text-muted" : "font-medium text-ink/90"}>{loc.city}</p> : null}
          </div>
          {mapUrl ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink"
            >
              Open in Maps →
            </a>
          ) : null}
        </div>
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-ink/10 bg-sand">
          <span className="text-xs uppercase tracking-widest text-muted">Map preview</span>
        </div>
      </div>
    </section>
  );
}
