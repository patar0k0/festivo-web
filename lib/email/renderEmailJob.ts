import type { EmailJobRow } from "./emailJobRow";
import type { EmailJobType } from "./emailJobTypes";
import { buildEmailJobContent, resolveEmailJobSubjectFromRegistry } from "./emailRegistry";

/**
 * Subject: explicit `job.subject` wins; otherwise registry default for type + payload.
 */
export function resolveEmailJobSubject(job: EmailJobRow, type: EmailJobType): string {
  return resolveEmailJobSubjectFromRegistry(type, job.subject, job.payload);
}

/**
 * Built content for a job whose `type` was already validated (`parseEmailJobType`).
 */
export async function renderEmailJob(
  job: EmailJobRow,
  type: EmailJobType,
): Promise<{ subject: string; html: string; text: string }> {
  return buildEmailJobContent(type, job.subject, job.payload);
}
