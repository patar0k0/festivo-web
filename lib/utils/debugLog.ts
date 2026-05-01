/** Logs only outside production (local/staging diagnostics). */
export function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}
