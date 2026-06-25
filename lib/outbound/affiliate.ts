/**
 * Booking.com affiliate attribution.
 *
 * The `aid` value may come from a direct Booking.com Affiliate Partner Program
 * account OR from a Travelpayouts Booking program — the URL shape is identical
 * either way (append `aid` + `label`). `aid` is NOT a secret: it appears in the
 * public outbound link the user clicks.
 */

export type BookingAffiliateOptions = {
  /** Booking affiliate id. Empty/undefined → URL returned unchanged. */
  aid?: string | null;
  /** Label prefix for per-festival stats. Defaults to "festivo". */
  labelPrefix?: string | null;
};

/** Collapse anything outside [a-z0-9_] to single dashes; trim leading/trailing dashes. */
function sanitizeLabelSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Append Booking affiliate `aid` + a festival-scoped `label` to a clean
 * booking.com URL. Returns the input unchanged when `aid` is empty or the URL
 * cannot be parsed (fail-safe — the link must always still work).
 */
export function withBookingAffiliate(
  rawUrl: string,
  festivalId: string | null | undefined,
  opts: BookingAffiliateOptions,
): string {
  const aid = opts.aid?.trim();
  if (!aid) return rawUrl;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }

  const prefix = sanitizeLabelSegment(opts.labelPrefix?.trim() || "festivo") || "festivo";
  const idSegment = sanitizeLabelSegment(String(festivalId ?? "")) || "site";

  url.searchParams.set("aid", aid);
  url.searchParams.set("label", `${prefix}-${idSegment}`);
  return url.toString();
}
