const BULGARIAN_PREFIXES = ["сдружение", "фондация"];

function stripWrapperQuotes(value: string): string {
  let result = value;
  for (let i = 0; i < 3; i += 1) {
    result = result.replace(/^["'„“”«»]+/, "").replace(/["'„“”«»]+$/, "").trim();
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
