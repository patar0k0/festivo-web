/**
 * Short UI labels for LLM/research provider keys (API metadata, evidence_json, etc.).
 */
export function getAIProviderLabel(provider: string | null | undefined): string {
  if (provider == null) return "AI";
  const raw = String(provider).trim();
  if (!raw) return "AI";
  const key = raw.toLowerCase();
  if (key.includes("perplexity")) return "Perplexity";
  if (key.includes("gemini")) return "Gemini";
  if (key.includes("openai")) return "OpenAI";
  if (key.includes("mock")) return "Mock";
  if (key === "web" || key.startsWith("web")) return "Web";
  return raw.length <= 20 ? raw : `${raw.slice(0, 17)}…`;
}

/**
 * Best-effort provider key for pending festival rows (client-only; matches create-pending / research payloads).
 */
export function getPendingResearchProviderKey(
  evidenceJson: unknown,
  extractionVersion: string | null | undefined,
): string | null {
  if (evidenceJson && typeof evidenceJson === "object" && !Array.isArray(evidenceJson)) {
    const o = evidenceJson as Record<string, unknown>;
    if (typeof o.provider === "string" && o.provider.trim()) return o.provider.trim();
    const meta = o.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const p = (meta as Record<string, unknown>).provider;
      if (typeof p === "string" && p.trim()) return p.trim();
    }
  }
  const ex = (extractionVersion ?? "").toLowerCase();
  if (ex.includes("perplexity")) return "perplexity";
  if (ex.includes("research_candidates")) return "gemini_pipeline";
  if (ex.includes("openai")) return "openai_web";
  return null;
}
