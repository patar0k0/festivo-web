export type ParsedEvidenceSource = { type: string; url: string };

export function listEvidenceSources(evidenceJson: unknown): ParsedEvidenceSource[] {
  if (!evidenceJson || typeof evidenceJson !== "object" || Array.isArray(evidenceJson)) {
    return [];
  }
  const raw = (evidenceJson as Record<string, unknown>).sources;
  if (!Array.isArray(raw)) return [];

  const out: ParsedEvidenceSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url.trim() : "";
    if (!url) continue;
    const type = typeof o.type === "string" && o.type.trim() ? o.type.trim() : "unknown";
    out.push({ type, url });
  }
  return out;
}
