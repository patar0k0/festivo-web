/** DB mirror is source of truth for display when set; fall back to Auth JWT field. */
export function effectiveBannedUntilForDisplay(
  dbBannedUntil: string | null | undefined,
  authBannedUntil: string | null | undefined,
): string | null {
  if (dbBannedUntil != null && dbBannedUntil !== "") return dbBannedUntil;
  return authBannedUntil ?? null;
}

export function isUserBannedFromEitherSource(
  dbBannedUntil: string | null | undefined,
  authBannedUntil: string | null | undefined,
): boolean {
  const sources = [dbBannedUntil, authBannedUntil];
  for (const u of sources) {
    if (u != null && u !== "" && new Date(u) > new Date()) return true;
  }
  return false;
}
