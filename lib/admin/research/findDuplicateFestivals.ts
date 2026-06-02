import "server-only";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Lightweight duplicate detection for the Smart Research panel.
 *
 * Before an admin sends a freshly-researched festival into the moderation
 * pipeline, we check whether a festival with a similar title already exists in
 * either `festivals` (published/verified) or `pending_festivals` (already in
 * review). This prevents the most common moderation mistake: re-researching and
 * re-adding a festival that's already in the catalog.
 *
 * The match is intentionally fuzzy and runs entirely in-process (no pg_trgm
 * dependency): we fetch a bounded candidate set via `ilike` on the most
 * significant title words, then score each candidate by normalized word
 * overlap (Jaccard) in JS.
 */

export type DuplicateMatch = {
  id: string;
  title: string;
  table: "festival" | "pending";
  /** Admin detail route for this row. */
  href: string;
  start_date: string | null;
  status: string | null;
  /** 0..1 normalized title similarity. */
  score: number;
  /** Both titles reference the same year → almost certainly the same edition. */
  same_year: boolean;
};

// Common words that carry no discriminating signal between festival titles.
const STOPWORDS = new Set([
  "фестивал",
  "фестивала",
  "фестивали",
  "festival",
  "fest",
  "на",
  "и",
  "за",
  "в",
  "с",
  "по",
  "the",
  "of",
  "and",
  "for",
  "international",
  "международен",
  "национален",
  "годишен",
]);

function extractYear(text: string): string | null {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? m[1]! : null;
}

/** Lowercase, drop punctuation/years/stopwords → significant token set. */
function significantWords(title: string): Set<string> {
  const cleaned = title
    .toLowerCase()
    .replace(/[„""«»"'’.,!?:;()\[\]{}\-–—/\\]/g, " ")
    .replace(/\b20\d{2}\b/g, " ");
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Builds a Supabase `.or()` ilike filter over the longest significant words. */
function buildOrFilter(words: Set<string>): string | null {
  const top = [...words].sort((a, b) => b.length - a.length).slice(0, 4);
  if (top.length === 0) return null;
  // Words are already stripped of punctuation; escaping not required for these
  // alnum tokens. Commas separate the OR branches.
  return top.map((w) => `title.ilike.%${w}%`).join(",");
}

const CANDIDATE_LIMIT = 30;
// Below this score we don't surface the match at all.
const MIN_SCORE = 0.34;

export async function findDuplicateFestivals(params: {
  title: string;
  startDate?: string | null;
}): Promise<DuplicateMatch[]> {
  const title = params.title?.trim();
  if (!title) return [];

  const queryWords = significantWords(title);
  const orFilter = buildOrFilter(queryWords);
  if (!orFilter) return [];

  const queryYear = extractYear(title) ?? (params.startDate ? extractYear(params.startDate) : null);
  const admin = createSupabaseAdmin();

  const [festRes, pendRes] = await Promise.all([
    admin
      .from("festivals")
      .select("id,title,slug,start_date,status")
      .or(orFilter)
      .limit(CANDIDATE_LIMIT),
    admin
      .from("pending_festivals")
      .select("id,title,start_date,status")
      .or(orFilter)
      .neq("status", "rejected")
      .limit(CANDIDATE_LIMIT),
  ]);

  const matches: DuplicateMatch[] = [];

  const scoreRow = (rowTitle: string, rowStart: string | null): { score: number; sameYear: boolean } | null => {
    const score = jaccard(queryWords, significantWords(rowTitle));
    if (score < MIN_SCORE) return null;
    const rowYear = extractYear(rowTitle) ?? (rowStart ? extractYear(rowStart) : null);
    const sameYear = Boolean(queryYear && rowYear && queryYear === rowYear);
    return { score, sameYear };
  };

  for (const r of festRes.data ?? []) {
    const t = typeof r.title === "string" ? r.title : "";
    if (!t) continue;
    const scored = scoreRow(t, (r.start_date as string | null) ?? null);
    if (!scored) continue;
    matches.push({
      id: String(r.id),
      title: t,
      table: "festival",
      href: `/admin/festivals/${r.id}`,
      start_date: (r.start_date as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      score: scored.score,
      same_year: scored.sameYear,
    });
  }

  for (const r of pendRes.data ?? []) {
    const t = typeof r.title === "string" ? r.title : "";
    if (!t) continue;
    const scored = scoreRow(t, (r.start_date as string | null) ?? null);
    if (!scored) continue;
    matches.push({
      id: String(r.id),
      title: t,
      table: "pending",
      href: `/admin/pending-festivals/${r.id}`,
      start_date: (r.start_date as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      score: scored.score,
      same_year: scored.sameYear,
    });
  }

  // Strongest matches first; same-year matches bubble up within equal scores.
  matches.sort((a, b) => {
    if (a.same_year !== b.same_year) return a.same_year ? -1 : 1;
    return b.score - a.score;
  });

  return matches.slice(0, 6);
}
