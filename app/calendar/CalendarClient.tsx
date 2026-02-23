"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

const tabs = [
  { id: "upcoming", label: "Upcoming" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

const allEvents = [
  { id: "1", title: "Sunset Jazz", city: "Sofia", date: "12 Mar" },
  { id: "2", title: "Urban Food Fest", city: "Plovdiv", date: "22 Mar" },
  { id: "3", title: "Spring Folk Days", city: "Varna", date: "2 Apr" },
  { id: "4", title: "Art & Wine", city: "Burgas", date: "15 Apr" },
  { id: "5", title: "Kids Carnival", city: "Ruse", date: "27 Apr" },
  { id: "6", title: "Heritage Weekend", city: "Veliko Tarnovo", date: "3 May" },
];

export default function CalendarClient() {
  const [value, setValue] = useState("upcoming");

  const events = useMemo(() => {
    if (value === "month") return allEvents.slice(0, 4);
    if (value === "all") return allEvents;
    return allEvents.slice(0, 3);
  }, [value]);

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} value={value} onChange={setValue} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
              <CardDescription>
                {event.city} • {event.date}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600">A refined calendar view for planning your next weekend.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
