export type StrictBodyValidationResult =
  | { ok: true }
  | { ok: false; unknownKeys: string[] };

export function validateNoUnknownKeys(
  body: Record<string, unknown>,
  allowedKeys: readonly string[],
): StrictBodyValidationResult {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(body).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    return { ok: false, unknownKeys };
  }

  return { ok: true };
}
