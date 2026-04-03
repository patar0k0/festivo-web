export const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || "Festivo <noreply@festivo.bg>";

/** Optional operations inbox for admin-only alerts (new claim / new submission). Not required for core flows. */
export function getEmailAdmin(): string | null {
  const v = process.env.EMAIL_ADMIN?.trim();
  return v || null;
}

/** Optional Reply-To header on outbound messages. */
export function getEmailReplyTo(): string | null {
  const v = process.env.EMAIL_REPLY_TO?.trim();
  return v || null;
}
