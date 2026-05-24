import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmailJobRow } from "./emailJobRow";
import { EMAIL_JOB_TYPE_WELCOME, type EmailJobType } from "./emailJobTypes";
import { buildEmailJobContent, resolveEmailJobSubjectFromRegistry } from "./emailRegistry";
import { resolveOptionalEmailLinks } from "./resolveOptionalEmailLinks";

/**
 * Subject: explicit `job.subject` wins; otherwise registry default for type + payload.
 */
export function resolveEmailJobSubject(job: EmailJobRow, type: EmailJobType): string {
  return resolveEmailJobSubjectFromRegistry(type, job.subject, job.payload);
}

/** Types whose payload should be enriched with unsubscribe + manage links at render time. */
const OPTIONAL_LINK_TYPES: ReadonlySet<EmailJobType> = new Set<EmailJobType>([
  EMAIL_JOB_TYPE_WELCOME,
]);

/**
 * Built content for a job whose `type` was already validated (`parseEmailJobType`).
 *
 * For marketing/onboarding types listed in `OPTIONAL_LINK_TYPES`, looks up the
 * recipient's unsubscribe token and injects `unsubscribeUrl` and
 * `managePreferencesUrl` into the payload before rendering. Lookup failure is
 * non-fatal — the email renders without footer links rather than failing.
 */
export async function renderEmailJob(
  supabase: SupabaseClient,
  job: EmailJobRow,
  type: EmailJobType,
): Promise<{ subject: string; html: string; text: string }> {
  let payload = job.payload as Record<string, unknown>;

  if (OPTIONAL_LINK_TYPES.has(type) && job.recipient_user_id) {
    const hasLinksInPayload =
      typeof payload?.unsubscribeUrl === "string" && payload.unsubscribeUrl.trim().length > 0;

    if (!hasLinksInPayload) {
      const links = await resolveOptionalEmailLinks(supabase, job.recipient_user_id);
      if (links) {
        payload = {
          ...payload,
          unsubscribeUrl: links.unsubscribeUrl,
          managePreferencesUrl: links.managePreferencesUrl,
        };
      }
    }
  }

  return buildEmailJobContent(type, job.subject, payload);
}
