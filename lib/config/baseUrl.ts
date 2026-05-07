/**
 * Canonical site origin for transactional email links.
 * Requires `NEXT_PUBLIC_SITE_URL` — no localhost/production guesswork in the email pipeline.
 */
export function getBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) {
    throw new Error("Missing NEXT_PUBLIC_SITE_URL");
  }
  return raw;
}
