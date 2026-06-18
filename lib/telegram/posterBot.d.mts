export function verifyWebhookSecret(headerSecret: string | null | undefined, expected: string | null | undefined): boolean;
export function buildPosterDedupeKey(chatId: number | string, fileUniqueId: string): string;
export function extractUrlsFromMessage(message: unknown): string[];

export type PosterAction =
  | { kind: "ignore" }
  | { kind: "photo"; chatId: number; userId: number; fileId: string; fileUniqueId: string; caption: string }
  | { kind: "url"; chatId: number; userId: number; url: string; urls: string[] }
  | { kind: "dup-decision"; chatId: number; userId: number; callbackQueryId: string; jobId: string; decision: "create" | "discard" | "enrich" | "reprocess"; dupId: string | null };

export function mapPosterUpdate(update: unknown): PosterAction;

export function formatInserted(input: { pendingId: string; title: string; needsReview: boolean; baseUrl: string }): string;
export function dupKeyboard(jobId: string, dupId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
export function formatEnriched(input: { kind: "patched_pending" | "proposal_created" | "nothing_to_patch"; fields: string[]; baseUrl: string; targetId: string; targetTable: "pending" | "festival" }): string;
export function reprocessKeyboard(jobId: string): { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };
export function formatDuplicate(matches: Array<{ title: string; href: string }>, baseUrl: string): string;
export function formatAlreadyDone(input: { pendingId: string | null; baseUrl: string }): string;
export function formatRejected(input: { pendingId: string | null; baseUrl: string }): string;

export function formatUrlResultLine(
  url: string,
  result:
    | { ok: true; kind: "queued" | "already_queued" }
    | { ok: true; kind: "duplicate_warning"; existing: { type: "pending" | "published"; id: string } }
    | { ok: false; kind: "error"; error: string },
  baseUrl: string,
): string;
