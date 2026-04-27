import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import {
  dedupeKeyOrganizerClaimApproved,
  dedupeKeyOrganizerClaimRejected,
} from "@/lib/email/emailDedupeKeys";
import {
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
} from "@/lib/email/emailJobTypes";
import { sendEmail as sendViaResend } from "@/lib/email/sendEmail";

function htmlToText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1) ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const result = await sendViaResend({
    to,
    subject,
    html,
    text: htmlToText(html),
  });
  if (!result.ok) {
    throw new Error(
      result.errorMessage ?? (result.missingApiKey ? "RESEND_API_KEY is not set" : "send failed"),
    );
  }
}

type DirectTransactionalEmail = { to: string; subject: string; html: string };

/** Direct Resend first; on failure enqueue `email_jobs` (structured payload for registry render). Does not throw. */
export async function trySendOrganizerClaimApprovedEmail(
  admin: SupabaseClient,
  args: {
    memberId: string;
    recipient: string;
    recipientUserId: string;
    direct: DirectTransactionalEmail;
    queuePayload: {
      organizerName: string;
      organizerSlug: string | null;
      dashboardUrl: string;
    };
  },
): Promise<void> {
  try {
    await sendEmail(args.direct);
  } catch (e) {
    console.error("email failed", e);
    await enqueueEmailJobSafe(
      admin,
      {
        type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
        recipientEmail: args.recipient,
        recipientUserId: args.recipientUserId,
        payload: {
          organizerName: args.queuePayload.organizerName,
          organizerSlug: args.queuePayload.organizerSlug,
          dashboardUrl: args.queuePayload.dashboardUrl,
        },
        dedupeKey: dedupeKeyOrganizerClaimApproved(args.memberId),
      },
      "organizer-claim-approved-fallback",
    );
  }
}

/** Same as {@link trySendOrganizerClaimApprovedEmail} for claim rejected. Does not throw. */
export async function trySendOrganizerClaimRejectedEmail(
  admin: SupabaseClient,
  args: {
    memberId: string;
    recipient: string;
    recipientUserId: string;
    direct: DirectTransactionalEmail;
    queuePayload: { organizerName: string };
  },
): Promise<void> {
  try {
    await sendEmail(args.direct);
  } catch (e) {
    console.error("email failed", e);
    await enqueueEmailJobSafe(
      admin,
      {
        type: EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
        recipientEmail: args.recipient,
        recipientUserId: args.recipientUserId,
        payload: { organizerName: args.queuePayload.organizerName },
        dedupeKey: dedupeKeyOrganizerClaimRejected(args.memberId),
      },
      "organizer-claim-rejected-fallback",
    );
  }
}
