import { logError } from "./logger";
import { attachRequestIdHeader, getOrCreateRequestId } from "./requestId";
import { measureDurationMs } from "./timing";

export type RouteObservabilityOptions = {
  /** Event name for uncaught errors (default: `route_uncaught_error`). */
  eventOnError?: string;
};

/**
 * Lightweight wrapper: request id, duration on failure, `x-request-id` on responses.
 * Does not log successful responses (call sites keep domain-specific success logs).
 */
export function withRouteObservability(
  handler: (request: Request) => Promise<Response> | Response,
  options?: RouteObservabilityOptions,
): (request: Request) => Promise<Response> {
  const eventOnError = options?.eventOnError ?? "route_uncaught_error";
  return async (request: Request) => {
    const requestId = getOrCreateRequestId(request);
    const started = performance.now();
    try {
      const res = await Promise.resolve(handler(request));
      return attachRequestIdHeader(res, requestId);
    } catch (error) {
      logError(eventOnError, {
        request_id: requestId,
        duration_ms: measureDurationMs(started),
        err: error instanceof Error ? error.name : "unknown",
      });
      throw error;
    }
  };
}
