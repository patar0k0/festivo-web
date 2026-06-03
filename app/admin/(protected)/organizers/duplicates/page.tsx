import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerDuplicatesTable from "@/components/admin/OrganizerDuplicatesTable";
import { getAdminContext } from "@/lib/admin/isAdmin";
import {
  extractEmailDomain,
  extractWebsiteDomain,
  normalizeOrganizerFacebookUrl,
  normalizeOrganizerNameAggressive,
  normalizeOrganizerNameForMatch,
  normalizeOrganizerSlug,
} from "@/lib/admin/organizerNormalization";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type OrganizerRow = {
  id: string;
  name: string | null;
  slug: string | null;
  facebook_url: string | null;
  website_url: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  festivalCount?: number;
};

type DuplicateRow = {
  left: OrganizerRow;
  right: OrganizerRow;
  reasons: string[];
  confidence: "high" | "medium";
};

type DismissedRow = {
  left: OrganizerRow;
  right: OrganizerRow;
};

function pairKey(a: string, b: string) {
  return [a, b].sort().join(":");
}

const HIGH_CONFIDENCE_REASONS = new Set([
  "exact normalized name",
  "exact slug",
  "exact facebook_url",
]);

// Generic/shared email providers — not org-specific, useless as a duplicate signal.
const GENERIC_EMAIL_DOMAINS = new Set([
  "abv.bg", "mail.bg", "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.bg", "hotmail.com", "hotmail.bg",
  "outlook.com", "live.com", "icloud.com", "me.com",
  "dir.bg", "gbg.bg", "bg.com",
]);

// Shared infrastructure domains (municipal portals, village sites) — not org-specific.
const GENERIC_WEBSITE_DOMAINS = new Set([
  "government.bg", "egov.bg",
]);

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
    byPair.set(key, { left: a, right: b, reasons: [reason], confidence: "medium" });
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

  // High-confidence signals (exact match on normalized fields)
  bucketize((row) => normalizeOrganizerNameForMatch(row.name), "exact normalized name");
  bucketize((row) => normalizeOrganizerSlug(row.slug), "exact slug");
  bucketize((row) => normalizeOrganizerFacebookUrl(row.facebook_url), "exact facebook_url");

  // Medium-confidence signals
  bucketize((row) => normalizeOrganizerNameAggressive(row.name), "similar name (normalized)");
  bucketize((row) => {
    const d = extractWebsiteDomain(row.website_url);
    return d && !GENERIC_WEBSITE_DOMAINS.has(d) ? d : null;
  }, "same website domain");
  bucketize((row) => {
    const d = extractEmailDomain(row.email);
    return d && !GENERIC_EMAIL_DOMAINS.has(d) ? d : null;
  }, "same email domain");

  // Promote pairs that have at least one high-confidence reason
  for (const row of byPair.values()) {
    if (row.reasons.some((r) => HIGH_CONFIDENCE_REASONS.has(r))) {
      row.confidence = "high";
    }
  }

  return Array.from(byPair.values()).sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "high" ? -1 : 1;
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
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Детекцията на дубликати е временно недостъпна.
      </div>
    );
  }

  const { data, error } = await adminClient
    .from("organizers")
    .select("id,name,slug,facebook_url,website_url,email,description,logo_url,phone")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<OrganizerRow[]>();

  if (error) {
    console.error("[admin/organizers/duplicates/page] organizers query failed", { message: error.message });
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        {error.message}
      </div>
    );
  }

  const allDuplicateRows = buildDuplicateRows(data ?? []);

  // Load dismissals and split active / dismissed
  const { data: dismissals } = await adminClient
    .from("organizer_duplicate_dismissals")
    .select("organizer_a,organizer_b")
    .returns<Array<{ organizer_a: string; organizer_b: string }>>();

  const dismissedKeys = new Set(
    (dismissals ?? []).map((d) => pairKey(d.organizer_a, d.organizer_b)),
  );

  const activeRows = allDuplicateRows.filter(
    (r) => !dismissedKeys.has(pairKey(r.left.id, r.right.id)),
  );
  const dismissedRows: DismissedRow[] = allDuplicateRows
    .filter((r) => dismissedKeys.has(pairKey(r.left.id, r.right.id)))
    .map((r) => ({ left: r.left, right: r.right }));

  // Festival counts for organizers in active pairs only
  const activeIds = new Set<string>();
  for (const r of activeRows) {
    activeIds.add(r.left.id);
    activeIds.add(r.right.id);
  }

  const festivalCountMap = new Map<string, number>();
  if (activeIds.size > 0) {
    const { data: festivalLinks } = await adminClient
      .from("festival_organizers")
      .select("organizer_id")
      .in("organizer_id", Array.from(activeIds))
      .returns<Array<{ organizer_id: string }>>();

    for (const link of festivalLinks ?? []) {
      festivalCountMap.set(
        link.organizer_id,
        (festivalCountMap.get(link.organizer_id) ?? 0) + 1,
      );
    }
  }

  const enrichedRows: DuplicateRow[] = activeRows.map((r) => ({
    ...r,
    left: { ...r.left, festivalCount: festivalCountMap.get(r.left.id) ?? 0 },
    right: { ...r.right, festivalCount: festivalCountMap.get(r.right.id) ?? 0 },
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-black/[0.08] bg-white/85 p-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Дубликати на организатори</h1>
          <p className="mt-1 text-sm text-black/65">
            Кандидати за дублиране по нормализирани полета. Merge-ът е необратим — проверявай преди да действаш.
          </p>
        </div>
        <Link
          href="/admin/organizers"
          className="rounded-lg border border-black/[0.12] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.04]"
        >
          Назад
        </Link>
      </div>

      <OrganizerDuplicatesTable rows={enrichedRows} dismissedRows={dismissedRows} />
    </div>
  );
}
