const BULGARIAN_PREFIXES = ["сдружение", "фондация"];

function stripWrapperQuotes(value: string): string {
  let result = value;
  for (let i = 0; i < 3; i += 1) {
    // Only strip trailing quotes when the string also starts with a quote.
    // This prevents names like `НЧ „Искра-1912"` from losing their closing mark.
    if (!/^["'„""«»]/.test(result)) break;
    result = result.replace(/^["'„""«»]+/, "").replace(/["'„""«»]+$/, "").trim();
  }
  return result;
}

function stripBulgarianPrefix(value: string): string {
  const lower = value.toLocaleLowerCase("bg-BG");
  for (const prefix of BULGARIAN_PREFIXES) {
    if (!lower.startsWith(prefix)) continue;

    const suffix = value.slice(prefix.length).trimStart();
    if (!suffix) return value;

    const withoutConnector = suffix.replace(/^[-–—:\.]\s*/, "");
    const withoutQuotes = stripWrapperQuotes(withoutConnector);
    if (withoutQuotes) {
      return withoutQuotes;
    }
  }

  return value;
}

export function normalizeOrganizerName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  return stripWrapperQuotes(collapsed).replace(/\s+/g, " ").trim() || null;
}

export function normalizeOrganizerNameForMatch(value: unknown): string | null {
  const normalized = normalizeOrganizerName(value);
  if (!normalized) return null;

  const withoutPrefix = stripBulgarianPrefix(normalized);
  const collapsed = withoutPrefix.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;

  return collapsed.toLocaleLowerCase("bg-BG");
}

export function normalizeOrganizerSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("bg-BG");
  return normalized || null;
}

export function normalizeOrganizerFacebookUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleLowerCase("bg-BG");
  return normalized || null;
}

export function normalizeOrganizerNameAggressive(value: unknown): string | null {
  const matched = normalizeOrganizerNameForMatch(value);
  if (!matched) return null;
  // Strip everything except letters (incl. Cyrillic) and digits
  const stripped = matched.replace(/[^\p{L}\p{N}]/gu, "");
  return stripped || null;
}

export function extractWebsiteDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return hostname || null;
  } catch {
    return null;
  }
}

export function extractEmailDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const atIdx = value.lastIndexOf("@");
  if (atIdx === -1) return null;
  const domain = value.slice(atIdx + 1).trim().toLowerCase();
  return domain || null;
}
