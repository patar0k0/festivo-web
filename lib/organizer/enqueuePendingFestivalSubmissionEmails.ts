import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
} from "@/lib/email/emailJobTypes";
import { dedupeKeyAdminNewSubmission, dedupeKeyFestivalSubmissionReceived } from "@/lib/email/emailDedupeKeys";
import { absoluteSiteUrl } from "@/lib/email/emailUrls";
import { enqueueAdminEmailJobSafe, enqueueEmailJobSafe } from "@/lib/email/enqueueSafe";
import { formatBgDateFromIso } from "@/lib/email/formatBg";
import { resolveAuthUserEmail } from "@/lib/email/resolveAuthUserEmail";

export async function enqueueOrganizerPortalSubmissionEmails(
  admin: SupabaseClient,
  args: {
    pendingId: string;
    userId: string;
    title: string;
    cityDisplay: string | null;
    startDate: string;
  },
): Promise<void> {
  const submitterEmail = await resolveAuthUserEmail(admin, args.userId);
  const startDateDisplay = formatBgDateFromIso(args.startDate);
  if (submitterEmail) {
    void enqueueEmailJobSafe(
      admin,
      {
        type: EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
        recipientEmail: submitterEmail,
        recipientUserId: args.userId,
        payload: {
          submissionId: args.pendingId,
          festivalTitle: args.title,
          cityDisplay: args.cityDisplay,
          startDateDisplay,
          submissionsUrl: absoluteSiteUrl("/organizer/submissions"),
        },
        dedupeKey: dedupeKeyFestivalSubmissionReceived(args.pendingId),
      },
      "organizer_portal_submission_user",
    );
  } else {
    console.warn("[email_jobs] skip festival-submission-received: no auth email for submitter", {
      user_id: args.userId,
      pending_id: args.pendingId,
    });
  }

  void enqueueAdminEmailJobSafe(
    admin,
    {
      type: EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
      payload: {
        submissionId: args.pendingId,
        festivalTitle: args.title,
        cityDisplay: args.cityDisplay,
        startDateDisplay,
        reviewUrl: absoluteSiteUrl(`/admin/pending-festivals/${args.pendingId}`),
      },
      dedupeKey: dedupeKeyAdminNewSubmission(args.pendingId),
    },
    "organizer_portal_submission_admin",
  );
}
