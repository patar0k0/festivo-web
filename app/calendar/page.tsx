import { format } from "date-fns";
import { redirect } from "next/navigation";
import { parseFilters } from "@/lib/filters";
import { serializeFilters } from "@/lib/filters";

export default function CalendarIndex({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const month = format(new Date(), "yyyy-MM");
  const filters = parseFilters(searchParams);
  const query = serializeFilters(filters);
  redirect(`/calendar/${month}${query}`);
}
