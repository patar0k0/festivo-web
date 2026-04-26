export function isFestivalPast(festival: {
  start_date?: string | null;
  end_date?: string | null;
}): boolean {
  // TODO: when start_time/end_time are available, treat "today" as past only after the effective local end time.
  const date = festival.end_date || festival.start_date;
  if (!date) return false;

  const eventDate = new Date(date);
  const now = new Date();

  return eventDate < now;
}
