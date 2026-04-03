/** Format YYYY-MM-DD (or ISO prefix) for BG copy in emails. */
export function formatBgDateFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const day = iso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}
