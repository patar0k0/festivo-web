/** Failed-attempt count after this failure (1 = first failure just occurred). */
export const MAX_USER_SWEEP_ATTEMPTS = 5;

function withJitter(baseMs: number): number {
  const jitterMultiplier = 1 + Math.random() * 0.3;
  return Math.round(baseMs * jitterMultiplier);
}

/** Milliseconds until next_retry_at after the Nth consecutive failure (N = 1..4). */
export function sweepRetryDelayMsAfterFailure(failureCount: number): number | null {
  switch (failureCount) {
    case 1:
      return withJitter(5 * 60 * 1000);
    case 2:
      return withJitter(15 * 60 * 1000);
    case 3:
      return withJitter(60 * 60 * 1000);
    case 4:
      return withJitter(6 * 60 * 60 * 1000);
    default:
      return null;
  }
}

export function sweepRetryLongDeferMs(): number {
  return 6 * 60 * 60 * 1000;
}
