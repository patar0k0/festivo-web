/**
 * Build the public redirect URL that records an outbound click then 302s to the target.
 */
export function outboundClickHref(args: {
  targetUrl: string;
  festivalId?: string | null;
  type: string;
  source: string;
}): string {
  const params = new URLSearchParams();
  params.set("url", args.targetUrl);
  if (args.festivalId) params.set("festival_id", String(args.festivalId));
  params.set("type", args.type);
  params.set("source", args.source);
  return `/out?${params.toString()}`;
}
