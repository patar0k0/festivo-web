/**
 * Safe display helpers for `admin_audit_logs.details` (jsonb).
 * Avoids dumping secrets/PII-heavy fields in expanded JSON views.
 */

const SENSITIVE_KEY_SUBSTRINGS = ["password", "secret", "token", "cookie", "authorization", "api_key", "jwt", "session"];

function keyLooksSensitive(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_SUBSTRINGS.some((s) => k.includes(s));
}

function truncateString(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export type AuditDetailsPreview = {
  chips: string[];
  summaryLine: string | null;
};

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function stringFromScalar(v: unknown): string | null {
  if (typeof v === "string") return asNonEmptyString(v);
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return null;
}

/**
 * Compact one-line + optional chips for table cells (no raw JSON).
 */
export function formatAuditDetailsPreview(details: unknown): AuditDetailsPreview {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return { chips: [], summaryLine: null };
  }

  const d = details as Record<string, unknown>;
  const chips: string[] = [];

  const changed = d.changed_fields;
  if (Array.isArray(changed)) {
    const maxShow = 12;
    for (let i = 0; i < Math.min(changed.length, maxShow); i++) {
      const s = stringFromScalar(changed[i]);
      if (s) chips.push(s);
    }
    if (changed.length > maxShow) {
      chips.push(`+${changed.length - maxShow} полета`);
    }
  }

  const title =
    asNonEmptyString(d.title) ??
    asNonEmptyString(d.target_title) ??
    asNonEmptyString(d.name) ??
    asNonEmptyString(d.target_name);
  const slug = asNonEmptyString(d.slug) ?? asNonEmptyString(d.target_slug);

  const parts: string[] = [];
  if (title) parts.push(truncateString(title, 80));
  if (slug) parts.push(`/${truncateString(slug, 48)}`);

  const cityId = d.city_id ?? d.target_city_id;
  const cityStr = stringFromScalar(cityId);
  if (cityStr) parts.push(`град ${cityStr}`);

  const orgId = d.organizer_id ?? d.target_organizer_id;
  const orgStr = stringFromScalar(orgId);
  if (orgStr) parts.push(`орг. ${truncateString(orgStr, 12)}`);

  const orgIds = d.organizer_ids;
  if (Array.isArray(orgIds) && orgIds.length) {
    parts.push(`${orgIds.length} орг.`);
  }

  if (typeof d.ids_count === "number" && Number.isFinite(d.ids_count)) {
    parts.push(`${d.ids_count} записа`);
  }

  const status = asNonEmptyString(d.status);
  if (status) parts.push(`статус ${status}`);

  const summaryLine = parts.length ? truncateString(parts.join(" · "), 140) : null;

  return { chips, summaryLine };
}

type SanitizeOpts = {
  maxDepth: number;
  maxKeysPerObject: number;
  maxStringLen: number;
};

const DEFAULT_SANITIZE: SanitizeOpts = {
  maxDepth: 8,
  maxKeysPerObject: 48,
  maxStringLen: 400,
};

/**
 * Produces a redacted, depth/key-bounded structure safe to `JSON.stringify` in the UI.
 */
export function sanitizeAuditDetailsForDisplay(value: unknown, depth = 0, opts: SanitizeOpts = DEFAULT_SANITIZE): unknown {
  if (depth > opts.maxDepth) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncateString(value, opts.maxStringLen);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value !== "object") return String(value);

  if (Array.isArray(value)) {
    const cap = 80;
    const slice = value.slice(0, cap).map((item) => sanitizeAuditDetailsForDisplay(item, depth + 1, opts));
    if (value.length > cap) {
      return [...slice, `[+${value.length - cap} more]`];
    }
    return slice;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const key of keys) {
    if (count >= opts.maxKeysPerObject) {
      out["__truncated_keys"] = keys.length - count;
      break;
    }
    if (keyLooksSensitive(key)) {
      out[key] = "[redacted]";
      count += 1;
      continue;
    }
    const kl = key.toLowerCase();
    if (kl === "email" || kl.endsWith("_email") || kl.includes("phone")) {
      out[key] = "[redacted]";
      count += 1;
      continue;
    }
    out[key] = sanitizeAuditDetailsForDisplay(obj[key], depth + 1, opts);
    count += 1;
  }
  return out;
}
