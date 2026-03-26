import { addDays, format, isValid, parseISO } from "date-fns";
import { outboundClickHref } from "@/lib/outbound/outboundLink";

function buildBookingSearchUrl(place: string, startDateIso: string, endDateIso?: string | null): string | null {
  const trimmed = place.trim();
  if (!trimmed) return null;

  const start = parseISO(startDateIso);
  if (!isValid(start)) return null;

  let end = endDateIso ? parseISO(endDateIso) : addDays(start, 1);
  if (!isValid(end)) end = addDays(start, 1);
  if (end.getTime() <= start.getTime()) end = addDays(start, 1);

  const u = new URL("https://www.booking.com/searchresults.html");
  u.searchParams.set("ss", trimmed);
  u.searchParams.set("checkin", format(start, "yyyy-MM-dd"));
  u.searchParams.set("checkout", format(end, "yyyy-MM-dd"));
  return u.toString();
}

type Props = {
  place: string;
  startDate: string;
  endDate?: string | null;
  festivalId: string;
};

export default function FestivalNearbyBookingCard({ place, startDate, endDate, festivalId }: Props) {
  const href = buildBookingSearchUrl(place, startDate, endDate);
  if (!href) return null;

  const trackedHref = outboundClickHref({
    targetUrl: href,
    festivalId,
    type: "booking",
    source: "festival_detail",
  });

  return (
    <section
      className="rounded-2xl border border-black/[0.07] bg-white/90 p-5 shadow-[0_1px_0_rgba(12,14,20,0.04)]"
      aria-labelledby="festival-nearby-booking-heading"
    >
      <h2 id="festival-nearby-booking-heading" className="text-lg font-semibold text-[#0c0e14]">
        🏨 Настаняване наблизо
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-black/55">Виж наличности за тези дати около фестивала.</p>
      <a
        href={trackedHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center rounded-xl border border-black/[0.1] bg-white px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:border-black/20 hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
      >
        Виж настаняване
      </a>
      <p className="mt-2 text-[11px] leading-relaxed text-black/40">Отваря се в Booking.com</p>
    </section>
  );
}
