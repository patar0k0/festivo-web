/** Logs only outside production (local/staging diagnostics). */
export function debugLog(level: "log" | "warn" | "error", ...args: unknown[]): void {
  if (process.env.NODE_ENV !== "production") {
    console[level](...args);
  }
}
