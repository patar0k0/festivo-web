import { pushRuntimeEvent } from "./runtimeStore";
import type { ObservabilityEventMeta, ObservabilityLevel } from "./types";

const MAX_STRING_LEN = 1000;
const STORE_MAX_STRING = 256;
const STORE_MAX_DEPTH = 4;
const STORE_MAX_KEYS = 40;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  if (
    k === "authorization" ||
    k === "cookie" ||
    k === "cookies" ||
    k === "set-cookie" ||
    k === "email" ||
    k.endsWith("_email") ||
    k.includes("password") ||
    k === "csrf" ||
    k === "bearer"
  ) {
    return true;
  }
  if (k === "token" || k.endsWith("_token") || k.includes("api_key") || k.includes("apikey")) return true;
  if (k.includes("secret")) return true;
  return false;
}

function redactStringContent(s: string): string {
  const out = s.replace(EMAIL_RE, "[REDACTED_EMAIL]");
  if (out.startsWith("eyJ") && out.length > 40) {
    return "[REDACTED_JWT]";
  }
  return out;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return truncate(redactStringContent(value), MAX_STRING_LEN);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value !== "object") return undefined;
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);
  if (depth <= 0) return "[MaxDepth]";
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const cap = Math.min(value.length, 200);
    for (let i = 0; i < cap; i += 1) {
      out.push(sanitizeValue(value[i], depth - 1, seen));
    }
    if (value.length > cap) out.push(`…+${value.length - cap}`);
    return out;
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const keys = Object.keys(obj);
  const cap = Math.min(keys.length, 200);
  for (let i = 0; i < cap; i += 1) {
    const k = keys[i];
    if (!k || isSensitiveKey(k)) continue;
    const v = obj[k];
    if (v instanceof Headers) continue;
    out[k] = sanitizeValue(v, depth - 1, seen);
  }
  return out;
}

function sanitizeMeta(meta: ObservabilityEventMeta | undefined): ObservabilityEventMeta {
  if (!meta || typeof meta !== "object") return {};
  const seen = new WeakSet<object>();
  const raw = sanitizeValue(meta, 12, seen);
  return typeof raw === "object" && raw !== null && !Array.isArray(raw)
    ? (raw as ObservabilityEventMeta)
    : { _meta: raw };
}

function compactMetaForStore(meta: ObservabilityEventMeta): ObservabilityEventMeta {
  const seen = new WeakSet<object>();

  function walk(v: unknown, depth: number): unknown {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") return truncate(redactStringContent(v), STORE_MAX_STRING);
    if (typeof v === "number" || typeof v === "boolean") return v;
    if (typeof v !== "object") return undefined;
    if (seen.has(v as object)) return "[Circular]";
    if (depth <= 0) return "[Truncated]";
    seen.add(v as object);
    if (Array.isArray(v)) {
      return v.slice(0, 20).map((x) => walk(x, depth - 1));
    }
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(o).slice(0, STORE_MAX_KEYS);
    for (const k of keys) {
      if (isSensitiveKey(k)) continue;
      out[k] = walk(o[k], depth - 1);
    }
    return out;
  }

  const out = walk(meta, STORE_MAX_DEPTH);
  return typeof out === "object" && out !== null && !Array.isArray(out) ? (out as ObservabilityEventMeta) : { v: out };
}

function safeStringify(payload: ObservabilityEventMeta, fallback: { level: ObservabilityLevel; event: string; ts: string }): string {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(payload, (_key, val) => {
      if (typeof val === "object" && val !== null) {
        if (seen.has(val as object)) return "[Circular]";
        seen.add(val as object);
      }
      if (typeof val === "string" && val.length > MAX_STRING_LEN) {
        return truncate(val, MAX_STRING_LEN);
      }
      return val;
    });
  } catch {
    return JSON.stringify({
      level: fallback.level,
      event: fallback.event,
      ts: fallback.ts,
      log_emit_error: "stringify_failed",
    });
  }
}

function emit(level: ObservabilityLevel, event: string, meta?: ObservabilityEventMeta): void {
  const sanitized = sanitizeMeta(meta);
  const ts = new Date().toISOString();
  const payload: ObservabilityEventMeta = { ...sanitized, level, event, ts };
  const line = safeStringify(payload, { level, event, ts });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);

  pushRuntimeEvent({
    level,
    event,
    ts,
    meta: compactMetaForStore(sanitized),
  });
}

export function logInfo(event: string, meta?: ObservabilityEventMeta): void {
  emit("info", event, meta);
}

export function logWarn(event: string, meta?: ObservabilityEventMeta): void {
  emit("warn", event, meta);
}

export function logError(event: string, meta?: ObservabilityEventMeta): void {
  emit("error", event, meta);
}
