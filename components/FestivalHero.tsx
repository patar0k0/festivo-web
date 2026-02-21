import Image from "next/image";
import { format, parseISO } from "date-fns";
import { Festival } from "@/lib/types";
import OpenInAppButton from "@/components/OpenInAppButton";
import QRCodeBlock from "@/components/QRCodeBlock";
import { festivalDeepLink } from "@/lib/deepLink";

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start) return "Dates TBA";
  const startDate = parseISO(start);
  if (!end || end === start) {
    return format(startDate, "d MMM yyyy");
  }
  return `${format(startDate, "d MMM")} - ${format(parseISO(end), "d MMM yyyy")}`;
}

export default function FestivalHero({ festival }: { festival: Festival }) {
  const deepLink = festivalDeepLink(festival.slug);
  return (
    <section className="relative overflow-hidden rounded-3xl border border-ink/10 bg-ink/80">
      <div className="absolute inset-0">
        <Image
          src={festival.hero_image ?? festival.cover_image ?? "/hero.svg"}
          alt={festival.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/40 to-transparent" />
      </div>
      <div className="relative z-10 grid gap-8 p-8 text-white md:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">
            {festival.city ?? "Bulgaria"} · {formatDateRange(festival.start_date, festival.end_date)}
          </p>
          <h1 className="text-3xl font-semibold md:text-5xl">{festival.title}</h1>
          {festival.is_free && <span className="badge bg-white/90 text-ink">Free</span>}
          <div className="flex flex-wrap items-center gap-4">
            <OpenInAppButton deepLink={deepLink} />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [festival.address, festival.city].filter(Boolean).join(", ")
              )}`}
              className="rounded-full border border-white/40 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              target="_blank"
              rel="noreferrer"
            >
              Directions
            </a>
            <a
              href={`/festival/${festival.slug}/ics`}
              className="rounded-full border border-white/40 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
            >
              Add to calendar
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <QRCodeBlock value={deepLink} />
          <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-sm text-white/80">
            <p className="font-semibold text-white">Save in the Festivo app</p>
            <p>Get reminders, personal plans, and offline details.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
