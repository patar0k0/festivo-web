import crypto from 'node:crypto';

export const SUPPORTED_NETWORKS = ['tiktok', 'instagram'];

const FB_URL_RE = /(https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.watch|fb\.com)\/[^\s]+)/i;

export function verifyWebhookSecret(headerSecret, expected) {
  return Boolean(expected) && headerSecret === expected;
}

export function buildDedupeKey(chatId, sourceUrl) {
  const raw = `${chatId}::${String(sourceUrl).trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function normalizeTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const t of targets || []) {
    if (SUPPORTED_NETWORKS.includes(t) && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
}

// Maps a raw Telegram update to a discrete bot action.
export function mapUpdateToAction(update) {
  const cq = update?.callback_query;
  if (cq) {
    const parts = String(cq.data || '').split(':');
    const base = { chatId: cq.message?.chat?.id, userId: cq.from?.id, callbackQueryId: cq.id };
    if (parts[0] === 'wpost') {
      return { kind: 'weekend-decision', postId: parts[1], decision: parts[2], ...base };
    }
    if (parts[0] === 'job' && parts[2] === 'toggle') return { kind: 'toggle', jobId: parts[1], network: parts[3], ...base };
    if (parts[0] === 'job') return { kind: 'decision', jobId: parts[1], decision: parts[2], ...base };
    return { kind: 'ignore' };
  }
  const msg = update?.message;
  if (msg && typeof msg.text === 'string') {
    const m = msg.text.match(FB_URL_RE);
    if (m) return { kind: 'enqueue', chatId: msg.chat?.id, userId: msg.from?.id, url: m[1] };
    return { kind: 'caption', chatId: msg.chat?.id, userId: msg.from?.id, text: msg.text.trim() };
  }
  return { kind: 'ignore' };
}

// Maps a decision button to the next job status.
export function decisionToStatus(decision) {
  const map = { publish_now: 'publishing', schedule: 'scheduled', cancel: 'cancelled' };
  return map[decision] || null;
}

// Maps a weekend-post decision button to the next scheduled-post status.
// 'regenerate' returns null (handled separately by re-running the worker generator).
export function weekendDecisionToStatus(decision) {
  const map = { publish_now: 'publishing', schedule: 'scheduled', cancel: 'cancelled' };
  return map[decision] || null;
}
