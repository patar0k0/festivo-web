export function verifyWebhookSecret(headerSecret: string | null | undefined, expected: string | null | undefined): boolean;
export function buildPosterDedupeKey(chatId: number | string, fileUniqueId: string): string;
export function extractUrlsFromMessage(message: unknown): string[];

export type PosterAction =
  | { kind: "ignore" }
  | { kind: "photo"; chatId: number; userId: number; fileId: string; fileUniqueId: string; caption: string }
  | { kind: "url"; chatId: number; userId: number; url: string; urls: string[] }
  | { kind: "dup-decision"; chatId: number; userId: number; callbackQueryId: string; jobId: string; decision: "create" | "discard" };

export function mapPosterUpdate(update: unknown): PosterAction;

export function formatInserted(input: { pendingId: string; title: string; needsReview: boolean; baseUrl: string }): string;
export function dupKeyboard(jobId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
export function formatDuplicate(matches: Array<{ title: string; href: string }>, baseUrl: string): string;
