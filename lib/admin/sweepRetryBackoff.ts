/** Failed-attempt count after this failure (1 = first failure just occurred). */
export const MAX_USER_SWEEP_ATTEMPTS = 5;

/** Milliseconds until next_retry_at after the Nth consecutive failure (N = 1..4). */
export function sweepRetryDelayMsAfterFailure(failureCount: number): number | null {
  switch (failureCount) {
    case 1:
      return 5 * 60 * 1000;
    case 2:
      return 15 * 60 * 1000;
    case 3:
      return 60 * 60 * 1000;
    case 4:
      return 6 * 60 * 60 * 1000;
    default:
      return null;
  }
}

export function sweepRetryLongDeferMs(): number {
  return 6 * 60 * 60 * 1000;
}
