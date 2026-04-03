import {
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_FESTIVAL_APPROVED,
  EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
  EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
} from "./emailJobTypes";

/**
 * Constructs `email_jobs.dedupe_key` at enqueue sites (not in the processor).
 * Values must stay stable for the same real-world event (entity + action).
 */
export function dedupeKeyOrganizerClaimReceived(organizerMemberId: string) {
  return `${EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED}:${organizerMemberId}`;
}

export function dedupeKeyAdminNewClaim(organizerMemberId: string) {
  return `${EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM}:${organizerMemberId}`;
}

export function dedupeKeyOrganizerClaimApproved(organizerMemberId: string) {
  return `${EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED}:${organizerMemberId}`;
}

export function dedupeKeyOrganizerClaimRejected(organizerMemberId: string) {
  return `${EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED}:${organizerMemberId}`;
}

export function dedupeKeyFestivalSubmissionReceived(pendingFestivalId: string) {
  return `${EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED}:${pendingFestivalId}`;
}

export function dedupeKeyAdminNewSubmission(pendingFestivalId: string) {
  return `${EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION}:${pendingFestivalId}`;
}

/** One approval email per pending moderation record (aligns with `festival-rejected`). */
export function dedupeKeyFestivalApproved(pendingFestivalId: string) {
  return `${EMAIL_JOB_TYPE_FESTIVAL_APPROVED}:${pendingFestivalId}`;
}

export function dedupeKeyFestivalRejected(pendingFestivalId: string) {
  return `${EMAIL_JOB_TYPE_FESTIVAL_REJECTED}:${pendingFestivalId}`;
}
