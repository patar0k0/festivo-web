import Link from "next/link";
import { redirect } from "next/navigation";
import FestivalDuplicatesTable from "@/components/admin/FestivalDuplicatesTable";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type FestivalRow = {
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

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

/** Normalize title for matching: trim, collapse spaces, lowercase. */
function normalizeTitleForMatch(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  // Strip leading/trailing quotes and "Фестивал на" type prefixes for fuzzy match
  const clean = value
    .trim()
    .toLowerCase()
    .replace(/[„"'"«»]/g, "")
    .replace(/\s+/g, " ");
  return clean || null;
}

function buildDuplicateRows(rows: FestivalRow[]): FestivalDuplicateRow[] {
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

  // 1. Exact normalized title
  bucketize((row) => normalizeTitleForMatch(row.title), "еднакво заглавие");

  // 2. Same slug
  bucketize((row) => {
    if (!row.slug) return null;
    return row.slug.trim().toLowerCase();
  }, "еднакъв slug");

  // 3. Same title (normalized) + same start_date
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    const d = row.start_date;
    if (!t || !d) return null;
    return `${t}|${d}`;
  }, "еднакво заглавие + начална дата");

  // 4. Same title (normalized) + same city
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    const c = row.city_id;
    if (!t || !c) return null;
    return `${t}|${c}`;
  }, "еднакво заглавие + град");

  // 5. Same title + same date + same city (strongest signal)
  bucketize((row) => {
    const t = normalizeTitleForMatch(row.title);
    const d = row.start_date;
    const c = row.city_id;
    if (!t || !d || !c) return null;
    return `${t}|${d}|${c}`;
  }, "еднакво заглавие + дата + град");

  return Array.from(byPair.values()).sort((a, b) => {
    // More signals = higher in list
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return (a.left.title ?? "").localeCompare(b.left.title ?? "", "bg-BG");
  });
}

export default async function FestivalDuplicatesPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/festivals/duplicates");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin/festivals/duplicates/page] Admin client init failed", { message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Услугата е временно недостъпна.
      </div>
    );
  }

  const { data, error } = await adminClient
    .from("festivals")
    .select("id,title,slug,start_date,city_id,cities:cities!festivals_city_id_fkey(name_bg),status")
    .neq("status", "archived")
    .order("title", { ascending: true })
    .returns<(Omit<FestivalRow, "city_name"> & { cities: { name_bg: string | null } | null })[]>();

  if (error) {
    console.error("[admin/festivals/duplicates/page] query failed", { message: error.message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        {error.message}
      </div>
    );
  }

  const rows: FestivalRow[] = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    start_date: r.start_date,
    city_id: r.city_id,
    city_name: r.cities?.name_bg ?? null,
    status: r.status,
  }));

  const duplicateRows = buildDuplicateRows(rows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Дублирани фестивали</h1>
          <p className="mt-1 text-sm text-black/65">
            Кандидати за дублиране по нормализирано заглавие, дата и град.{" "}
            <span className="font-medium">{duplicateRows.length} двойки</span> от{" "}
            <span className="font-medium">{rows.length} фестивала</span>.
          </p>
        </div>
        <Link
          href="/admin/festivals"
          className="rounded-lg border border-black/[0.12] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
        >
          Назад
        </Link>
      </div>

      <FestivalDuplicatesTable rows={duplicateRows} />
    </div>
  );
}
