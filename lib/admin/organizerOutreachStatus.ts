import type { SupabaseClient } from "@supabase/supabase-js";

export type OrganizerOutreachStatus = "contacted" | "not_contacted" | "no_email";

export type OutreachStatusInfo = {
  status: OrganizerOutreachStatus;
  lastContactedAt: string | null;
};

const OUTREACH_DEDUPE_PREFIX = "organizer-outreach";

/**
 * Parses the organizer id out of an outreach `email_jobs.dedupe_key`
 * (format: `organizer-outreach:{organizerId}:{email}:{date}`).
 * Returns null for keys from other email types or malformed keys.
 */
export function parseOutreachDedupeKey(dedupeKey: string | null): string | null {
  if (!dedupeKey) return null;
  const parts = dedupeKey.split(":");
  if (parts.length < 2 || parts[0] !== OUTREACH_DEDUPE_PREFIX) return null;
  return parts[1] || null;
}

/**
 * Reduces raw outreach email_jobs rows into organizerId -> most recent created_at (ISO string).
 * Rows that aren't parseable as outreach dedupe keys are skipped.
 */
export function buildOutreachContactedMap(
  rows: { dedupe_key: string | null; created_at: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const organizerId = parseOutreachDedupeKey(row.dedupe_key);
    if (!organizerId) continue;
    const existing = map.get(organizerId);
    if (!existing || row.created_at > existing) {
      map.set(organizerId, row.created_at);
    }
  }
  return map;
}

/**
 * Classifies a single organizer's outreach status.
 * Contacted takes priority over no_email: an organizer emailed in the past
 * still shows as contacted even if their stored email was since cleared/changed.
 */
export function classifyOutreachStatus(
  email: string | null | undefined,
  organizerId: string,
  contactedMap: Map<string, string>,
): OutreachStatusInfo {
  const lastContactedAt = contactedMap.get(organizerId) ?? null;
  if (lastContactedAt) {
    return { status: "contacted", lastContactedAt };
  }
  if (!email || !email.trim()) {
    return { status: "no_email", lastContactedAt: null };
  }
  return { status: "not_contacted", lastContactedAt: null };
}

const DEFAULT_OUTREACH_FETCH_PAGE_SIZE = 1000;

/**
 * Fetches every `organizer-outreach` email_jobs row (paginated, since there's no upper
 * bound on how many outreach emails will be sent over time) and reduces them into an
 * organizerId -> most recent contacted-at map.
 */
export async function fetchAllOrganizerOutreachContactedMap(
  client: SupabaseClient,
  pageSize: number = DEFAULT_OUTREACH_FETCH_PAGE_SIZE,
): Promise<Map<string, string>> {
  const rows: { dedupe_key: string | null; created_at: string }[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await client
      .from("email_jobs")
      .select("dedupe_key,created_at")
      .eq("type", OUTREACH_DEDUPE_PREFIX)
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    // Supabase's default (un-generic'd) client types `data` as `any`; the actual
    // shape is constrained by the `.select("dedupe_key,created_at")` above.
    const page = (data ?? []) as { dedupe_key: string | null; created_at: string }[];
    rows.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return buildOutreachContactedMap(rows);
}
