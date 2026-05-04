import type { EmailJobRow } from "./emailJobRow";

/** Terminal queue failure: no more retries (see `finalizeSendFailure` / preference skips). */
export function isDeadLetter(job: Pick<EmailJobRow, "status" | "attempts" | "max_attempts">): boolean {
  return job.status === "failed" && job.attempts >= job.max_attempts;
}
