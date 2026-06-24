import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminAction } from "@/lib/admin/audit-log";
import {
  dedupeKeyAdminAutoClaimGranted,
  dedupeKeyOrganizerAutoClaimApproved,
} from "@/lib/email/emailDedupeKeys";
import { EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED, EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED } from "@/lib/email/emailJobTypes";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";
import { enqueueAdminEmailJobSafe, enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";

export type OrganizerAutoClaimResult =
  | { claimed: false }
  | { claimed: true; organizerId: string; organizerName: string; organizerSlug: string | null };

type OrganizerCandidateRow = { id: string; name: string; slug: string | null };

/** Escapes `%`/`_`/`\` so a user-controlled email can't inject ilike wildcards. */
function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return (err as { code?: string }).code === "23505";
  }
  return false;
}

/**
 * If `userEmail` exactly matches (case-insensitive) exactly one active, unclaimed
 * organizer profile's `email` field, grants the user `owner`/`active` membership on
 * that profile, marks it verified, and notifies the user + admin. No-ops on 0 or 2+
 * matches, or if the sole match already has an active owner (never adds a second
 * owner). See docs/superpowers/specs/2026-06-23-organizer-auto-claim-by-email-design.md.
 */
export async function attemptOrganizerAutoClaimByEmail(
  admin: SupabaseClient,
  userId: string,
  userEmail: string,
): Promise<OrganizerAutoClaimResult> {
  const email = userEmail.trim().toLowerCase();
  if (!email) return { claimed: false };

  const { data: candidates, error: candidatesErr } = await admin
    .from("organizers")
    .select("id,name,slug")
    .eq("is_active", true)
    .ilike("email", escapeIlikeLiteral(email));

  if (candidatesErr) {
    console.error("[organizer_auto_claim] candidate lookup failed", { message: candidatesErr.message });
    return { claimed: false };
  }

  const candidateRows = (candidates ?? []) as OrganizerCandidateRow[];
  if (candidateRows.length === 0) return { claimed: false };

  const candidateIds = candidateRows.map((c) => c.id);
  const { data: ownerRows, error: ownerErr } = await admin
    .from("organizer_members")
    .select("organizer_id")
    .in("organizer_id", candidateIds)
    .eq("role", "owner")
    .eq("status", "active");

  if (ownerErr) {
    console.error("[organizer_auto_claim] owner lookup failed", { message: ownerErr.message });
    return { claimed: false };
  }

  const ownedIds = new Set((ownerRows ?? []).map((r) => r.organizer_id as string));
  const unclaimed = candidateRows.filter((c) => !ownedIds.has(c.id));
  if (unclaimed.length !== 1) return { claimed: false };

  const match = unclaimed[0];
  const nowIso = new Date().toISOString();

  const { error: insertErr } = await admin.from("organizer_members").insert({
    organizer_id: match.id,
    user_id: userId,
    role: "owner",
    status: "active",
    approved_at: nowIso,
    approved_by: userId,
  });

  if (insertErr) {
    if (isUniqueViolation(insertErr)) {
      // Already claimed concurrently (e.g. two rapid /organizer loads) — benign no-op.
      return { claimed: false };
    }
    console.error("[organizer_auto_claim] membership insert failed", { message: insertErr.message });
    return { claimed: false };
  }

  const { error: verifyErr } = await admin.from("organizers").update({ verified: true }).eq("id", match.id);
  if (verifyErr) {
    console.error("[organizer_auto_claim] verified flag update failed", { message: verifyErr.message });
  }

  void enqueueEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
      recipientEmail: email,
      recipientUserId: userId,
      payload: {
        organizerName: match.name,
        organizerSlug: match.slug ?? null,
        dashboardUrl: absoluteSiteUrl("/organizer/dashboard"),
      },
      dedupeKey: dedupeKeyOrganizerAutoClaimApproved(match.id, userId),
    },
    "organizer_auto_claim_user",
  );

  void enqueueAdminEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ADMIN_AUTO_CLAIM_GRANTED,
      payload: {
        organizerName: match.name,
        organizerSlug: match.slug ?? null,
        userId,
        userEmail: email,
        organizerAdminUrl: absoluteSiteUrl(`/admin/organizers/${match.id}/edit`),
      },
      dedupeKey: dedupeKeyAdminAutoClaimGranted(match.id, userId),
    },
    "organizer_auto_claim_admin",
  );

  void logAdminAction({
    actor_user_id: userId,
    action: "organizer_auto_claim_by_email",
    entity_type: "organizer",
    entity_id: match.id,
    details: { email, organizer_name: match.name },
  });

  return { claimed: true, organizerId: match.id, organizerName: match.name, organizerSlug: match.slug ?? null };
}
