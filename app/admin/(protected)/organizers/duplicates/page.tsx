import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerDuplicatesTable from "@/components/admin/OrganizerDuplicatesTable";
import { getAdminContext } from "@/lib/admin/isAdmin";
import {
  normalizeOrganizerFacebookUrl,
  normalizeOrganizerNameForMatch,
  normalizeOrganizerSlug,
} from "@/lib/admin/organizerNormalization";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type OrganizerRow = {
  id: string;
  name: string | null;
  slug: string | null;
  facebook_url: string | null;
};

type DuplicateRow = {
  left: OrganizerRow;
  right: OrganizerRow;
  reasons: string[];
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

function buildDuplicateRows(rows: OrganizerRow[]): DuplicateRow[] {
  const byPair = new Map<string, DuplicateRow>();

  const add = (left: OrganizerRow, right: OrganizerRow, reason: string) => {
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

  const bucketize = (keyFn: (row: OrganizerRow) => string | null, reason: string) => {
    const buckets = new Map<string, OrganizerRow[]>();
    for (const row of rows) {
      const key = keyFn(row);
      if (!key) continue;
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }

    for (const bucketRows of buckets.values()) {
      if (bucketRows.length < 2) continue;
      for (let i = 0; i < bucketRows.length; i += 1) {
        for (let j = i + 1; j < bucketRows.length; j += 1) {
          add(bucketRows[i], bucketRows[j], reason);
        }
      }
    }
  };

  bucketize((row) => normalizeOrganizerNameForMatch(row.name), "exact normalized name");
  bucketize((row) => normalizeOrganizerSlug(row.slug), "exact slug");
  bucketize((row) => normalizeOrganizerFacebookUrl(row.facebook_url), "exact facebook_url");

  return Array.from(byPair.values()).sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return (a.left.name ?? "").localeCompare(b.left.name ?? "", "bg-BG");
  });
}

export default async function OrganizerDuplicatesPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/organizers/duplicates");
  }

  let adminClient;
  try {
    adminClient = createSupabaseAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to initialize admin client";
    console.error("[admin/organizers/duplicates/page] Admin client initialization failed", { message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Organizer duplicate detection is temporarily unavailable.</div>;
  }

  const { data, error } = await adminClient
    .from("organizers")
    .select("id,name,slug,facebook_url")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<OrganizerRow[]>();

  if (error) {
    console.error("[admin/organizers/duplicates/page] organizers query failed", { message: error.message });
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const duplicateRows = buildDuplicateRows(data ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Organizer duplicates</h1>
          <p className="mt-1 text-sm text-black/65">Conservative duplicate candidates based on exact normalized fields.</p>
        </div>
        <Link href="/admin/organizers" className="rounded-lg border border-black/[0.12] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]">
          Back to organizers
        </Link>
      </div>

      <OrganizerDuplicatesTable rows={duplicateRows} />
    </div>
  );
}
