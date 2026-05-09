const HEADER = "x-request-id";
const INCOMING_MAX_LEN = 200;

function isValidIncomingId(raw: string): boolean {
  if (!raw || raw.length > INCOMING_MAX_LEN) return false;
  // Avoid control chars / newlines from hostile clients
  if (/[\r\n\0]/.test(raw)) return false;
  return true;
}

/**
 * Reuses `x-request-id` when present and sane; otherwise generates a new id.
 */
export function getOrCreateRequestId(request: Request): string {
  const incoming = request.headers.get(HEADER)?.trim() ?? "";
  if (isValidIncomingId(incoming)) return incoming.slice(0, INCOMING_MAX_LEN);
  return crypto.randomUUID();
}

/** Attaches `x-request-id` when missing (immutable Response pattern). */
export function attachRequestIdHeader(response: Response, requestId: string): Response {
  if (response.headers.get(HEADER)) return response;
  const headers = new Headers(response.headers);
  headers.set(HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
