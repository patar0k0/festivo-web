export const SUPPORTED_NETWORKS: string[];

export type BotAction =
  | { kind: "ignore" }
  | { kind: "enqueue"; chatId: number; userId: number; url: string }
  | { kind: "caption"; chatId: number; userId: number; text: string }
  | { kind: "toggle"; chatId: number; userId: number; jobId: string; network: string; callbackQueryId: string }
  | { kind: "decision"; chatId: number; userId: number; jobId: string; decision: string; callbackQueryId: string };

export function verifyWebhookSecret(headerSecret: string | null, expected: string | undefined): boolean;
export function buildDedupeKey(chatId: number, sourceUrl: string): string;
export function normalizeTargets(targets: string[]): string[];
export function mapUpdateToAction(update: unknown): BotAction;
export function decisionToStatus(decision: string): string | null;
