"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import CalendarMonthGrid from "@/components/calendar/CalendarMonthGrid";
import DayEventsList from "@/components/calendar/DayEventsList";
import { Festival } from "@/lib/types";

type CalendarViewClientProps = {
  month: string;
  dayCounts: Record<string, number>;
  festivalsByDay: Record<string, Festival[]>;
  initialSelectedDay: string;
};

export default function CalendarViewClient({
  month,
  dayCounts,
  festivalsByDay,
  initialSelectedDay,
}: CalendarViewClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedDay, setSelectedDay] = useState(initialSelectedDay);

  const selectedFestivals = useMemo(() => festivalsByDay[selectedDay] ?? [], [festivalsByDay, selectedDay]);

  const onChangeMonth = (nextMonth: string) => {
    const current = new URLSearchParams(searchParams.toString());
    const next = new URLSearchParams(searchParams.toString());

    next.set("month", nextMonth);
    next.delete("page");

    current.delete("page");
    const currentComparable = current.toString();
    const nextComparable = next.toString();

    if (currentComparable === nextComparable) {
      router.refresh();
      return;
    }

    router.push(nextComparable ? `${pathname}?${nextComparable}` : pathname, { scroll: false });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)]">
      <CalendarMonthGrid
        month={month}
        selectedDay={selectedDay}
        dayCounts={dayCounts}
        onSelectDay={setSelectedDay}
        onChangeMonth={onChangeMonth}
      />
      <DayEventsList day={selectedDay} festivals={selectedFestivals} />
    </div>
  );
}
