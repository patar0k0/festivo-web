const POST_PATH_PATTERNS = [
  /\/story\.php/i,
  /\/permalink\.php/i,
  /\/posts\//i,
  /\/groups\/[^/]+\/posts\//i,
  /\/share\/[pv]\//i, // facebook.com/share/p/<id>/ (post) and /share/v/<id>/ (video) — the newer "share" link format
];

export function normalizeFacebookPostUrl(input) {
  const trimmed = String(input ?? "").trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: "Invalid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "URL must start with http or https." };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "facebook.com" && !host.endsWith(".facebook.com")) {
    return { error: "URL must be a facebook.com post, permalink, or story link." };
  }

  const path = parsed.pathname.toLowerCase();
  if (!POST_PATH_PATTERNS.some((re) => re.test(path))) {
    return { error: "URL must be a facebook.com post, permalink, or story link." };
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";

  return { value: parsed.toString() };
}
