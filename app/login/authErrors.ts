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

export function signupErrorMessage(raw: string | undefined, fallback: string): string {
  const m = (raw ?? "").toLowerCase();

  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already registered")) {
    return "Има съществуващ профил с този имейл. Влез или ползвай 'Забравена парола?'.";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least"))) {
    return "Паролата е твърде слаба. Използвай поне 8 символа.";
  }
  if (m.includes("email")) {
    return "Провери дали имейл адресът е валиден.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Твърде много опити. Изчакай малко и опитай отново.";
  }

  return fallback;
}
