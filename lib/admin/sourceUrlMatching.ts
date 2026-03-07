export type SourceUrlMatchMeta = {
  rawUrl: string;
  normalizedUrl: string | null;
  facebookEventId: string | null;
};

function safeDecodeUri(input: string) {
  try {
    return decodeURI(input);
  } catch {
    return input;
  }
}

function safeDecodePathname(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function normalizeFacebookHost(hostname: string) {
  const lower = hostname.trim().toLowerCase();
  if (lower === "m.facebook.com" || lower === "mbasic.facebook.com" || lower === "mobile.facebook.com" || lower === "www.facebook.com") {
    return "facebook.com";
  }
  return lower;
}

function extractFacebookEventId(pathname: string, searchParams: URLSearchParams) {
  const fromQuery = searchParams.get("event_id")?.trim();
  if (fromQuery && /^\d{5,}$/.test(fromQuery)) {
    return fromQuery;
  }

  const decodedPath = safeDecodePathname(pathname).replace(/\/+$/, "");
  const patterns = [
    /\/events\/(\d{5,})(?:\/|$)/i,
    /\/events\/[^/]+\/(\d{5,})(?:\/|$)/i,
    /\/[^/]+\/events\/(\d{5,})(?:\/|$)/i,
    /\/[^/]+\/events\/[^/]+\/(\d{5,})(?:\/|$)/i,
  ];

  for (const pattern of patterns) {
    const match = decodedPath.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function getSourceUrlMatchMeta(sourceUrl: string | null | undefined): SourceUrlMatchMeta | null {
  if (!sourceUrl || typeof sourceUrl !== "string") return null;

  const rawUrl = sourceUrl.trim();
  if (!rawUrl) return null;

  const decoded = safeDecodeUri(rawUrl);

  let parsed: URL;
  try {
    parsed = new URL(decoded);
  } catch {
    try {
      parsed = new URL(rawUrl);
    } catch {
      return {
        rawUrl,
        normalizedUrl: rawUrl.toLowerCase(),
        facebookEventId: null,
      };
    }
  }

  const normalizedHost = normalizeFacebookHost(parsed.hostname);
  const decodedPathname = safeDecodePathname(parsed.pathname);
  const normalizedPathname = (decodedPathname.replace(/\/+$/, "") || "/") as string;

  const isFacebook = normalizedHost === "facebook.com" || normalizedHost.endsWith(".facebook.com");
  const facebookEventId = isFacebook ? extractFacebookEventId(normalizedPathname, parsed.searchParams) : null;

  const normalizedUrl = facebookEventId
    ? `${normalizedHost}/events/${facebookEventId}`
    : `${normalizedHost}${normalizedPathname === "/" ? "" : normalizedPathname}`;

  return {
    rawUrl,
    normalizedUrl,
    facebookEventId,
  };
}
