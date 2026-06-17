import "server-only";

const MAX_BYTES = 10 * 1024 * 1024;

export type TelegramFileDownload = { buffer: Buffer; mimeType: string };

/**
 * Resolves a Telegram file_id to bytes: getFile → download from the file CDN.
 * Token is read from TELEGRAM_POSTER_BOT_TOKEN.
 */
export async function downloadTelegramFile(fileId: string): Promise<TelegramFileDownload> {
  const token = process.env.TELEGRAM_POSTER_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_POSTER_BOT_TOKEN is not configured");

  const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  const getFileJson = (await getFileRes.json().catch(() => null)) as
    | { ok?: boolean; result?: { file_path?: string } }
    | null;
  const filePath = getFileJson?.result?.file_path;
  if (!getFileJson?.ok || !filePath) {
    throw new Error("Telegram getFile failed");
  }

  const dlRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!dlRes.ok) throw new Error(`Telegram file download failed (HTTP ${dlRes.status})`);

  const buffer = Buffer.from(await dlRes.arrayBuffer());
  if (buffer.byteLength === 0) throw new Error("Downloaded poster is empty");
  if (buffer.byteLength > MAX_BYTES) throw new Error("Poster file too large");

  const mimeType = dlRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  return { buffer, mimeType };
}
