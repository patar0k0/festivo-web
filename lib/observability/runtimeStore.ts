import type { ObservabilityEventMeta, ObservabilityLevel } from "./types";

const MAX_EVENTS = 500;
const ROLLING_MS = 24 * 60 * 60 * 1000;

export type RuntimeObservabilityEvent = {
  level: ObservabilityLevel;
  event: string;
  ts: string;
  meta: ObservabilityEventMeta;
};

const buffer: RuntimeObservabilityEvent[] = [];

function eventTimestampMs(ts: string): number {
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : 0;
}

export function pushRuntimeEvent(entry: RuntimeObservabilityEvent): void {
  buffer.unshift(entry);
  if (buffer.length > MAX_EVENTS) {
    buffer.length = MAX_EVENTS;
  }
}

/** Newest first; ring buffer only (not full history). */
export function getRuntimeEvents(): RuntimeObservabilityEvent[] {
  return buffer.slice();
}

export type RuntimeEventStats = {
  total24h: number;
  errors24h: number;
  warnings24h: number;
  infos24h: number;
  byLevel: Record<ObservabilityLevel, number>;
  byEvent: Record<string, number>;
  topEvents: { event: string; count: number }[];
};

export function getRuntimeEventStats(): RuntimeEventStats {
  const now = Date.now();
  const cutoff = now - ROLLING_MS;
  const recent = buffer.filter((e) => eventTimestampMs(e.ts) >= cutoff);

  const byLevel: Record<ObservabilityLevel, number> = { info: 0, warn: 0, error: 0 };
  const byEvent: Record<string, number> = {};

  for (const e of recent) {
    byLevel[e.level] += 1;
    byEvent[e.event] = (byEvent[e.event] ?? 0) + 1;
  }

  const topEvents = Object.entries(byEvent)
    .map(([event, count]) => ({ event, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    total24h: recent.length,
    errors24h: byLevel.error,
    warnings24h: byLevel.warn,
    infos24h: byLevel.info,
    byLevel,
    byEvent,
    topEvents,
  };
}
