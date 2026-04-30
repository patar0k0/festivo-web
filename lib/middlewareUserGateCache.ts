type GatePayload = {
  deleted_at: string | null;
  banned_until: string | null;
  exp: number;
};

const TTL_MS = 8_000;
const store = new Map<string, GatePayload>();

function prune(now: number): void {
  for (const [k, v] of store) {
    if (v.exp <= now) store.delete(k);
  }
}

export function getCachedUserGate(userId: string): GatePayload | null {
  const now = Date.now();
  if (store.size > 5000) {
    prune(now);
  }
  const row = store.get(userId);
  if (!row || row.exp <= now) {
    if (row) store.delete(userId);
    return null;
  }
  return row;
}

export function setCachedUserGate(
  userId: string,
  fields: { deleted_at: string | null; banned_until: string | null },
): void {
  store.set(userId, {
    deleted_at: fields.deleted_at,
    banned_until: fields.banned_until,
    exp: Date.now() + TTL_MS,
  });
}
