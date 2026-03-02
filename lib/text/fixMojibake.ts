const CYRILLIC_REGEX = /[\u0400-\u04FF]/;
const MOJIBAKE_HINT_REGEX = /[ÐÑРС]/;

export function fixMojibakeBG(value: string | null | undefined): string {
  if (!value) return value ?? "";

  if (!MOJIBAKE_HINT_REGEX.test(value)) {
    return value;
  }

  if (CYRILLIC_REGEX.test(value)) {
    const likelyRealCyrillic = /[А-Яа-я]/.test(value) && !/[ÐÑ]/.test(value);
    if (likelyRealCyrillic) return value;
  }

  const repaired = Buffer.from(value, "latin1").toString("utf8");
  if (!CYRILLIC_REGEX.test(repaired)) {
    return value;
  }

  return repaired;
}

