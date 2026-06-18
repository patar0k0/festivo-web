export type FestivalRow = {
  id: string;
  title: string | null;
  slug: string | null;
  start_date: string | null;
  city_id: number | null;
  city_name: string | null;
  status: string | null;
};

export type FestivalDuplicateRow = {
  left: FestivalRow;
  right: FestivalRow;
  reasons: string[];
};

const STOPWORDS = new Set(["на", "и", "за", "с", "в", "от", "до"]);

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

/** Normalize title for matching: trim, strip quotes, collapse spaces, lowercase. */
export function normalizeTitleForMatch(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[„"'"«»]/g, "")
    .replace(/\s+/g, " ");
  return clean || null;
}

function tokenizeTitle(value: string | null | undefined): string[] {
  const norm = normalizeTitleForMatch(value);
  if (!norm) return [];
  return norm
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Containment = |A ∩ B| / min(|A|, |B|); 0 unless both have >= 2 tokens. */
export function titleContainment(a: string | null | undefined, b: string | null | undefined): number {
  const ta = new Set(tokenizeTitle(a));
  const tb = new Set(tokenizeTitle(b));
  if (ta.size < 2 || tb.size < 2) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.min(ta.size, tb.size);
}

export function buildDuplicateRows(rows: FestivalRow[]): FestivalDuplicateRow[] {
  const byPair = new Map<string, FestivalDuplicateRow>();

  const add = (left: FestivalRow, right: FestivalRow, reason: string) => {
    if (left.id === right.id) return;
    const key = pairKey(left.id, right.id);
    const existing = byPair.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    const [a, b] = left.id < right.id ? [left, right] : [right, left];
    byPair.set(key, { left: a, right: b, reasons: [reason] });
  };

  type BucketKeyFn = (row: FestivalRow) => string | null;

  const bucketize = (keyFn: BucketKeyFn, reason: string) => {
    const buckets = new Map<string, FestivalRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      if (!key) continue;
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }
    for (const bucketRows of buckets.values()) {
      if (bucketRows.length < 2) continue;
      for (let i = 0; i < bucketRows.length; i++) {
        for (let j = i + 1; j < bucketRows.length; j++) {
          add(bucketRows[i], bucketRows[j], reason);
        }
      }
    }
  };

  // Exact signals (unchanged behavior).
  bucketize((row) => normalizeTitleForMatch(row.title), "еднакво заглавие");
  bucketize((row) => (row.slug ? row.slug.trim().toLowerCase() : null), "еднакъв slug");
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    return t && row.start_date ? `${t}|${row.start_date}` : null;
  }, "еднакво заглавие + начална дата");
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    return t && row.city_id ? `${t}|${row.city_id}` : null;
  }, "еднакво заглавие + град");
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    return t && row.start_date && row.city_id ? `${t}|${row.start_date}|${row.city_id}` : null;
  }, "еднакво заглавие + дата + град");

  // Fuzzy pass: pairwise, gated by same city OR same start_date to bound cost/false positives.
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      const na = normalizeTitleForMatch(a.title);
      const nb = normalizeTitleForMatch(b.title);
      if (na && nb && na === nb) continue; // already covered by exact signals
      const sameGate =
        (a.city_id != null && a.city_id === b.city_id) ||
        (!!a.start_date && a.start_date === b.start_date);
      if (!sameGate) continue;
      if (titleContainment(a.title, b.title) >= 0.8) add(a, b, "близко заглавие");
    }
  }

  return Array.from(byPair.values()).sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return (a.left.title ?? "").localeCompare(b.left.title ?? "", "bg-BG");
  });
}
