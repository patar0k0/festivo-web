import {
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_FESTIVAL_APPROVED,
  EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
  EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
  EMAIL_JOB_TYPE_REMINDER_1_DAY_BEFORE,
  EMAIL_JOB_TYPE_REMINDER_SAME_DAY,
  EMAIL_JOB_TYPE_TEST,
  type EmailJobType,
} from "./emailJobTypes";

/** How preference / unsubscribe rules apply to an `email_jobs.type` value. */
export type EmailTypeCategory =
  | "required_transactional"
  | "optional_reminder"
  | "optional_marketing"
  | "admin_alert";

const CATEGORY_BY_TYPE: Record<EmailJobType, EmailTypeCategory> = {
  [EMAIL_JOB_TYPE_TEST]: "required_transactional",
  [EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED]: "required_transactional",
  [EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED]: "required_transactional",
  [EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED]: "required_transactional",
  [EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED]: "required_transactional",
  [EMAIL_JOB_TYPE_FESTIVAL_APPROVED]: "required_transactional",
  [EMAIL_JOB_TYPE_FESTIVAL_REJECTED]: "required_transactional",
  [EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM]: "admin_alert",
  [EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION]: "admin_alert",
  [EMAIL_JOB_TYPE_REMINDER_1_DAY_BEFORE]: "optional_reminder",
  [EMAIL_JOB_TYPE_REMINDER_SAME_DAY]: "optional_reminder",
};

export function getEmailTypeCategory(type: EmailJobType): EmailTypeCategory {
  return CATEGORY_BY_TYPE[type];
}

export function isUserPreferenceGatedEmailType(type: EmailJobType): boolean {
  const c = CATEGORY_BY_TYPE[type];
  return c === "optional_reminder" || c === "optional_marketing";
}
