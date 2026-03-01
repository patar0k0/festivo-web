"use client";

import { useMemo } from "react";
import { addMonths, format, getDay, getDaysInMonth, parseISO } from "date-fns";

type CalendarMonthGridProps = {
  month: string;
  selectedDay: string;
  dayCounts: Record<string, number>;
  onSelectDay: (day: string) => void;
  onChangeMonth: (month: string) => void;
};

const WEEK_DAYS = ["Пон", "Вто", "Сря", "Чет", "Пет", "Съб", "Нед"];

export default function CalendarMonthGrid({
  month,
  selectedDay,
  dayCounts,
  onSelectDay,
  onChangeMonth,
}: CalendarMonthGridProps) {
  const monthStart = parseISO(`${month}-01`);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat("bg-BG", { month: "long", year: "numeric" }).format(monthStart),
    [monthStart]
  );

  const cells = useMemo(() => {
    const daysInMonth = getDaysInMonth(monthStart);
    const firstDayIndex = (getDay(monthStart) + 6) % 7;

    const values: Array<{ key: string; date?: Date }> = [];
    for (let i = 0; i < firstDayIndex; i += 1) {
      values.push({ key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = parseISO(`${month}-${String(day).padStart(2, "0")}`);
      values.push({ key: format(date, "yyyy-MM-dd"), date });
    }

    return values;
  }, [month, monthStart]);

  const prevMonth = format(addMonths(monthStart, -1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.07)] backdrop-blur md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onChangeMonth(prevMonth)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
        >
          Prev
        </button>
        <p className="text-lg font-bold capitalize tracking-tight text-[#0c0e14]">{monthLabel}</p>
        <button
          type="button"
          onClick={() => onChangeMonth(nextMonth)}
          className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#0c0e14] transition hover:bg-[#f7f6f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
        >
          Next
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
        {WEEK_DAYS.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="h-20 rounded-xl bg-transparent" aria-hidden="true" />;
          }

          const dayKey = format(cell.date, "yyyy-MM-dd");
          const count = dayCounts[dayKey] ?? 0;
          const selected = selectedDay === dayKey;
          const dateLabel = new Intl.DateTimeFormat("bg-BG", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(cell.date);

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay(dayKey)}
              aria-label={`${dateLabel}, ${count} фестивала`}
              className={`flex h-20 flex-col items-start justify-between rounded-xl border px-2.5 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25 ${
                selected
                  ? "border-[#0c0e14] bg-[#0c0e14] text-white"
                  : "border-black/[0.08] bg-white/80 text-[#0c0e14] hover:border-black/[0.18]"
              }`}
            >
              <span className="text-sm font-semibold">{format(cell.date, "d")}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  selected ? "bg-white/20 text-white" : "bg-black/[0.06] text-black/65"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${selected ? "bg-white" : count > 0 ? "bg-[#ff4c1f]" : "bg-black/20"}`}
                />
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
