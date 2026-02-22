import { redirect } from "next/navigation";
import { format } from "date-fns";

export const revalidate = 3600;

export default function CalendarPage() {
  const month = format(new Date(), "yyyy-MM");
  redirect(`/calendar/${month}`);
}
