import { FestivalDay, FestivalScheduleItem } from "@/lib/types";

function groupByDay(days: FestivalDay[], items: FestivalScheduleItem[]) {
  const map = new Map<string, FestivalScheduleItem[]>();
  items.forEach((item) => {
    const key = item.festival_day_id ? String(item.festival_day_id) : "unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key)?.push(item);
  });

  return days.map((day) => ({
    day,
    items: map.get(String(day.id)) ?? [],
  }));
}

export default function FestivalProgram({
  days,
  items,
}: {
  days: FestivalDay[];
  items: FestivalScheduleItem[];
}) {
  if (!days.length || !items.length) return null;
  const grouped = groupByDay(days, items);

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Program</h2>
      <div className="space-y-5">
        {grouped.map(({ day, items: dayItems }) => (
          <div key={day.id} className="rounded-2xl border border-ink/10 bg-white/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted">
              {day.label ?? day.date}
            </h3>
            <ul className="mt-4 space-y-3 text-sm">
              {dayItems.map((item) => (
                <li key={item.id} className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-muted">
                    {item.time ?? ""}
                  </span>
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
