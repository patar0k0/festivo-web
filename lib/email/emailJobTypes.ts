export const EMAIL_JOB_TYPE_TEST = "test" as const;

export const EMAIL_JOB_TYPES = [EMAIL_JOB_TYPE_TEST] as const;

export type EmailJobType = (typeof EMAIL_JOB_TYPES)[number];

export function isKnownEmailJobType(value: string): value is EmailJobType {
  return (EMAIL_JOB_TYPES as readonly string[]).includes(value);
}

export type TestEmailJobPayload = {
  name?: string;
};
