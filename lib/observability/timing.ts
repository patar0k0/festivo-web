/**
 * Elapsed milliseconds since `start` from `performance.now()`.
 */
export function measureDurationMs(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}
