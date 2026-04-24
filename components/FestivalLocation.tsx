import { formatPublicFestivalLocationSummary } from "@/lib/festival/publicLocationDisplay";
import { getFestivalLocationLines } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";
import { buildGoogleMapsUrl } from "@/lib/location/buildGoogleMapsUrl";

export default function FestivalLocation({ festival }: { festival: Festival }) {
  const summary = formatPublicFestivalLocationSummary(festival);
  const loc = getFestivalLocationLines(festival, "");
  const cityPrimary = loc.primary.trim();
  const citySub = loc.secondary?.trim() ?? "";
  if (!summary && !cityPrimary && !festival.city_name_display) return null;
  const display = [summary, loc.geoLine.trim() || cityPrimary].filter(Boolean).join(", ");
  const mapUrl =
    buildGoogleMapsUrl({
      place_id: festival.place_id,
      lat: festival.latitude ?? festival.lat,
      lng: festival.longitude ?? festival.lng,
    }) ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(display)}`;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Къде</h2>
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
          <div className="text-sm text-muted">
            {summary ? <p>{summary}</p> : null}
            {cityPrimary ? (
              <>
                <p className={summary ? "mt-2 font-medium text-ink/90" : ""}>{cityPrimary}</p>
                {citySub ? <p className="mt-0.5 text-xs text-muted">{citySub}</p> : null}
              </>
            ) : null}
          </div>
          <a
            href={mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-ink"
          >
            Open in Maps →
          </a>
        </div>
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-ink/10 bg-sand">
          <span className="text-xs uppercase tracking-widest text-muted">Map preview</span>
        </div>
      </div>
    </section>
  );
}
