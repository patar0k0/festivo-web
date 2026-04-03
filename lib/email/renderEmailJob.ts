import { createElement } from "react";

import { TestEmail } from "@/emails/templates/TestEmail";

import type { EmailJobRow } from "./emailJobRow";
import {
  EMAIL_JOB_TYPE_TEST,
  type EmailJobType,
  type TestEmailJobPayload,
} from "./emailJobTypes";
import { renderEmail } from "./render";

const DEFAULT_SUBJECT_BY_TYPE: Record<EmailJobType, string> = {
  [EMAIL_JOB_TYPE_TEST]: "Festivo — тестов имейл",
};

/**
 * Subject: explicit `job.subject` wins; otherwise default for the known job type.
 */
export function resolveEmailJobSubject(job: EmailJobRow, type: EmailJobType): string {
  const custom = job.subject?.trim();
  if (custom) return custom;
  return DEFAULT_SUBJECT_BY_TYPE[type];
}

/**
 * Built content for a job whose `type` was already validated (see `parseEmailJobType`).
 * Add new transactional types here in Phase 2+.
 */
export async function renderEmailJob(
  job: EmailJobRow,
  type: EmailJobType,
): Promise<{ subject: string; html: string; text: string }> {
  const subject = resolveEmailJobSubject(job, type);

  switch (type) {
    case EMAIL_JOB_TYPE_TEST: {
      const p = job.payload as TestEmailJobPayload;
      const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "приятел";
      const { html, text } = await renderEmail(createElement(TestEmail, { name }));
      return { subject, html, text };
    }
  }
}
