export const EMAIL_JOB_TYPE_TEST = "test" as const;
export const EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED = "organizer-claim-received" as const;
export const EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED = "organizer-claim-approved" as const;
export const EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED = "organizer-claim-rejected" as const;
export const EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED = "festival-submission-received" as const;
export const EMAIL_JOB_TYPE_FESTIVAL_APPROVED = "festival-approved" as const;
export const EMAIL_JOB_TYPE_FESTIVAL_REJECTED = "festival-rejected" as const;
export const EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM = "admin-new-claim" as const;
export const EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION = "admin-new-submission" as const;

export const EMAIL_JOB_TYPES = [
  EMAIL_JOB_TYPE_TEST,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
  EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
  EMAIL_JOB_TYPE_FESTIVAL_APPROVED,
  EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
] as const;

export type EmailJobType = (typeof EMAIL_JOB_TYPES)[number];

export function isKnownEmailJobType(value: string): value is EmailJobType {
  return (EMAIL_JOB_TYPES as readonly string[]).includes(value);
}

/** DB `type` text → narrow union; unknown values must not reach render/send. */
export function parseEmailJobType(value: string): EmailJobType | null {
  return isKnownEmailJobType(value) ? value : null;
}

export type TestEmailJobPayload = {
  name?: string;
};
