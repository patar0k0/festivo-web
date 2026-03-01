import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Festival } from "@/lib/types";

type DayEventsListProps = {
  day: string;
  festivals: Festival[];
};

function formatEventDate(startDate?: string | null, endDate?: string | null) {
  if (!startDate) {
    return "Дата предстои";
  }

  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) {
    return "Дата предстои";
  }

  if (!endDate || endDate === startDate) {
    return format(start, "d MMM yyyy");
  }

  const end = parseISO(endDate);
  if (Number.isNaN(end.getTime())) {
    return format(start, "d MMM yyyy");
  }

  return `${format(start, "d MMM")} - ${format(end, "d MMM yyyy")}`;
}

export default function DayEventsList({ day, festivals }: DayEventsListProps) {
  const parsedDay = parseISO(day);
  const heading = Number.isNaN(parsedDay.getTime())
    ? day
    : new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" }).format(parsedDay);

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight text-[#0c0e14]">Събития за {heading}</h2>
        <span className="rounded-full bg-black/[0.05] px-2.5 py-1 text-xs font-semibold text-black/60">{festivals.length}</span>
      </div>

      {festivals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/[0.1] bg-white/70 px-4 py-8 text-center text-sm text-black/60">
          Няма фестивали за избрания ден.
        </div>
      ) : (
        <div className="space-y-3">
          {festivals.map((festival) => (
            <Link
              key={`${festival.slug}-${festival.id}`}
              href={`/festival/${festival.slug}`}
              className="block rounded-xl border border-black/[0.09] bg-white p-4 transition hover:border-black/[0.16] hover:shadow-[0_8px_18px_rgba(12,14,20,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
            >
              <p className="text-base font-semibold text-[#0c0e14]">{festival.title}</p>
              <p className="mt-1 text-sm text-black/60">
                {festival.city ?? "България"} • {formatEventDate(festival.start_date, festival.end_date)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {festival.category ? (
                  <span className="rounded-full border border-black/[0.1] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-black/65">
                    {festival.category}
                  </span>
                ) : null}
                {festival.is_free ? (
                  <span className="rounded-full border border-[#ff4c1f]/25 bg-[#ff4c1f]/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#ff4c1f]">
                    Безплатно
                  </span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
