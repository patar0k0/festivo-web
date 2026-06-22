import "server-only";

const TG = (m: string) => `https://api.telegram.org/bot${process.env.TELEGRAM_POSTER_BOT_TOKEN}/${m}`;

/** Best-effort Telegram Bot API call for the poster bot; never throws. */
export async function sendPosterBotMessage(method: string, payload: unknown): Promise<void> {
  try {
    await fetch(TG(method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort; never fail the caller on delivery errors
  }
}
