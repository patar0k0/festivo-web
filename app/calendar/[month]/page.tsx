import { isValid, parseISO } from "date-fns";
import { redirect } from "next/navigation";

const MONTH_REGEX = /^\d{4}-\d{2}$/;

export const revalidate = 3600;

export default async function CalendarMonthCompatibilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ month: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { month } = await params;
  const rawSearch = await searchParams;

  const nextParams = new URLSearchParams();
  Object.entries(rawSearch).forEach(([key, value]) => {
    if (typeof value === "string") {
      nextParams.set(key, value);
      return;
    }

    if (Array.isArray(value)) {
      nextParams.set(key, value.join(","));
    }
  });

  if (MONTH_REGEX.test(month) && isValid(parseISO(`${month}-01`))) {
    nextParams.set("month", month);
  }

  const query = nextParams.toString();
  redirect(`/calendar${query ? `?${query}` : ""}`);
}
