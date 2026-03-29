import { formatPublicFestivalLocationSummary } from "@/lib/festival/publicLocationDisplay";
import { festivalCityLabel } from "@/lib/settlements/formatDisplayName";
import { Festival } from "@/lib/types";

export default function FestivalLocation({ festival }: { festival: Festival }) {
  const summary = formatPublicFestivalLocationSummary(festival);
  const cityL = festivalCityLabel(festival, "");
  if (!summary && !cityL && !festival.city && !festival.city_name_display) return null;
  const display = [summary, cityL].filter(Boolean).join(", ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(display)}`;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Къде</h2>
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-ink/10 bg-white/70 p-5">
          <p className="text-sm text-muted">{display}</p>
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
