/** Max length aligned with RPC `admin_set_user_soft_deleted` (public.users.deleted_reason). */
export const DELETED_REASON_MAX_LENGTH = 2000;

/**
 * Strip angle-bracket segments (HTML-like tags) and truncate for safe storage.
 * Server RPC applies the same pattern; this reduces junk before RPC.
 */
export function sanitizeDeletedReason(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const stripped = String(raw).replace(/<[^>]*>/gi, "").trim();
  if (!stripped) return null;
  return stripped.length > DELETED_REASON_MAX_LENGTH
    ? stripped.slice(0, DELETED_REASON_MAX_LENGTH)
    : stripped;
}
