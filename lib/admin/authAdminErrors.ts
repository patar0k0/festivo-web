/** Heuristic: GoTrue "no user" responses across supabase-js versions. */
export function isAuthUserNotFoundError(err: unknown): boolean {
  if (err == null) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return lower.includes("user not found") || lower.includes("users not found");
}
