import { format, parseISO } from "date-fns";
import { FestivalDay, FestivalScheduleItem } from "@/lib/types";

function groupByDay(days: FestivalDay[], items: FestivalScheduleItem[]) {
  const map = new Map<string, FestivalScheduleItem[]>();
  items.forEach((item) => {
    const key = item.day_id ? String(item.day_id) : "unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(item);
  });

  return days.map((day) => ({
    day,
    items: map.get(String(day.id)) ?? [],
  }));
}

function formatDayTitle(day: FestivalDay) {
  // festival_days uses "title" (legacy UI used "label")
  if (day.title) return day.title;
  try {
    return format(parseISO(day.date), "EEE, d MMM");
  } catch {
    return day.date;
  }
}

function formatTimeRange(start?: string | null, end?: string | null) {
  // schedule items use start_time/end_time (legacy UI used "time")
  const startValue = start ? start.slice(0, 5) : "";
  const endValue = end ? end.slice(0, 5) : "";
  if (startValue && endValue) return `${startValue}–${endValue}`;
  if (startValue) return startValue;
  return "";
}

export default function FestivalProgram({
  days,
  items,
}: {
  days: FestivalDay[];
  items: FestivalScheduleItem[];
}) {
  if (!days.length && !items.length) return null;
  const grouped = groupByDay(days, items);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Програма</h2>
      <div className="space-y-5">
        {grouped.map(({ day, items: dayItems }) => (
          <div key={day.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted">
              {formatDayTitle(day)}
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              {dayItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-muted">
                    {formatTimeRange(item.start_time, item.end_time)}
                  </span>
                  {item.stage ? (
                    <span className="text-xs uppercase tracking-widest text-muted">{item.stage}</span>
                  ) : null}
                  <span className="font-semibold text-ink">{item.title}</span>
                  {item.description && <span className="text-muted">{item.description}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
