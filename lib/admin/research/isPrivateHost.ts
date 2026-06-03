/**
 * Returns true when a hostname resolves to a private, loopback, or link-local
 * address. Used as an SSRF guard before any server-side fetch of an externally-
 * supplied URL.
 */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^(?:10\.|127\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(h) ||
    /^(?:fc|fd|fe80:)/i.test(h)
  );
}
