/**
 * User-facing Bulgarian messages for Supabase Auth failures (login / OAuth setup).
 */
export function loginErrorMessage(raw: string | undefined, fallback: string): string {
  const m = (raw ?? "").toLowerCase();

  if (m.includes("invalid login credentials") || m.includes("invalid_grant")) {
    return "Невалиден имейл или парола.";
  }
  if (m.includes("email not confirmed")) {
    return "Потвърди имейла си преди да влезеш (линкът е изпратен при регистрация).";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Твърде много опити. Изчакай малко и опитай отново.";
  }
  if (m.includes("user banned") || m.includes("banned")) {
    return "Този акаунт е блокиран.";
  }

  return fallback;
}
