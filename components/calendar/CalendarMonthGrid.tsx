"use client";

import { useMemo } from "react";
import { addMonths, format, getDay, getDaysInMonth, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { pub } from "@/lib/public-ui/styles";

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
  const todayMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia", year: "numeric", month: "2-digit" }).format(
    new Date(),
  );
  const isOnCurrentMonth = month === todayMonth;

  return (
    <div className={cn(pub.panelMuted, "p-4 md:p-5")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(prevMonth)}
            className={cn(pub.btnSecondarySm, "px-3 py-2 hover:bg-[#f7f6f3]", pub.focusRing)}
            aria-label="Предишен месец"
          >
            ‹
          </button>
          <p className="text-lg font-bold capitalize tracking-tight text-[#0c0e14]">{monthLabel}</p>
          <button
            type="button"
            onClick={() => onChangeMonth(nextMonth)}
            className={cn(pub.btnSecondarySm, "px-3 py-2 hover:bg-[#f7f6f3]", pub.focusRing)}
            aria-label="Следващ месец"
          >
            ›
          </button>
        </div>
        <button
          type="button"
          onClick={() => onChangeMonth(todayMonth)}
          disabled={isOnCurrentMonth}
          className={cn(
            pub.btnSecondarySm,
            "px-3 py-2 hover:bg-[#f7f6f3] disabled:cursor-not-allowed disabled:opacity-50",
            pub.focusRing,
          )}
          aria-label="Към днешния месец"
        >
          Днес
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.14em] text-black/65">
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

          const hasEvents = count > 0;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay(dayKey)}
              // WCAG 2.5.3 Label in Name: accessible name must start with the
              // visible text (the day number) so voice-control users can say
              // "click 22" and screen reader users hear the visible label first.
              aria-label={
                hasEvents
                  ? `${format(cell.date, "d")} — ${dateLabel}, ${count} ${count === 1 ? "фестивал" : "фестивала"}`
                  : `${format(cell.date, "d")} — ${dateLabel}, без фестивали`
              }
              className={cn(
                "flex h-20 flex-col items-start justify-between rounded-xl border px-2.5 py-2 text-left transition",
                pub.focusRing,
                selected
                  ? "border-[#7c2d12] bg-[#7c2d12] text-white"
                  : hasEvents
                    ? "border-amber-200/50 bg-amber-50/40 text-[#0c0e14] hover:border-amber-300/70"
                    : "border-black/[0.05] bg-white/50 text-black/55 hover:border-black/[0.12]",
              )}
            >
              <span className={cn("text-sm font-semibold", !selected && !hasEvents && "font-medium")}>
                {format(cell.date, "d")}
              </span>
              {hasEvents ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    selected ? "bg-white/20 text-white" : "bg-[#7c2d12]/10 text-[#7c2d12]",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", selected ? "bg-white" : "bg-[#7c2d12]")} />
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
