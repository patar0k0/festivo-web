import {
  EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM,
  EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION,
  EMAIL_JOB_TYPE_FESTIVAL_APPROVED,
  EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
  EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
  EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
  EMAIL_JOB_TYPE_REMINDER_1_DAY_BEFORE,
  EMAIL_JOB_TYPE_REMINDER_SAME_DAY,
  EMAIL_JOB_TYPE_TEST,
  isKnownEmailJobType,
} from "@/lib/email/emailJobTypes";
import { getEmailTypeCategory } from "@/lib/email/emailTypeCategory";

const SENSITIVE_KEY_SUBSTRINGS = [
  "unsubscribe",
  "token",
  "secret",
  "password",
  "api_key",
  "apikey",
  "authorization",
] as const;

function keyLooksSensitive(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEY_SUBSTRINGS.some((s) => k.includes(s));
}

/** Deep-clone JSON-like values and replace sensitive keys (admin detail only). */
export function maskSensitiveJsonForAdmin(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => maskSensitiveJsonForAdmin(v));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (keyLooksSensitive(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = maskSensitiveJsonForAdmin(v);
      }
    }
    return out;
  }
  return value;
}

export type EmailJobKindPreset = "reminder" | "organizer" | "admin_alert";

export const EMAIL_JOB_KIND_TYPES: Record<EmailJobKindPreset, readonly string[]> = {
  reminder: [EMAIL_JOB_TYPE_REMINDER_1_DAY_BEFORE, EMAIL_JOB_TYPE_REMINDER_SAME_DAY],
  organizer: [
    EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED,
    EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED,
    EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED,
    EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED,
    EMAIL_JOB_TYPE_FESTIVAL_APPROVED,
    EMAIL_JOB_TYPE_FESTIVAL_REJECTED,
  ],
  admin_alert: [EMAIL_JOB_TYPE_ADMIN_NEW_CLAIM, EMAIL_JOB_TYPE_ADMIN_NEW_SUBMISSION],
};

export function parseEmailJobKindPreset(raw: string | undefined): EmailJobKindPreset | null {
  if (raw === "reminder" || raw === "organizer" || raw === "admin_alert") return raw;
  return null;
}

/** Short BG label for category (raw `type` stays visible separately). */
export function emailJobCategoryLabel(type: string): string | null {
  if (!isKnownEmailJobType(type)) return null;
  const c = getEmailTypeCategory(type);
  if (c === "optional_reminder") return "Напомняне";
  if (c === "admin_alert") return "Админ алерт";
  if (c === "required_transactional") {
    if (type === EMAIL_JOB_TYPE_TEST) return "Тест";
    if (
      type === EMAIL_JOB_TYPE_ORGANIZER_CLAIM_RECEIVED ||
      type === EMAIL_JOB_TYPE_ORGANIZER_CLAIM_APPROVED ||
      type === EMAIL_JOB_TYPE_ORGANIZER_CLAIM_REJECTED
    ) {
      return "Орг. акаунт";
    }
    if (
      type === EMAIL_JOB_TYPE_FESTIVAL_SUBMISSION_RECEIVED ||
      type === EMAIL_JOB_TYPE_FESTIVAL_APPROVED ||
      type === EMAIL_JOB_TYPE_FESTIVAL_REJECTED
    ) {
      return "Орг. фестивал";
    }
    return "Transactional";
  }
  return null;
}

export function emailJobStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "sent") return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90";
  if (s === "pending") return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90";
  if (s === "processing") return "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90";
  if (s === "failed") return "bg-red-100 text-red-950 ring-1 ring-red-200/90";
  return "bg-black/[0.06] text-black/80 ring-1 ring-black/[0.1]";
}

export function emailDeliveryStatusBadgeClass(delivery: string | null | undefined): string {
  if (!delivery) return "bg-black/[0.05] text-black/55 ring-1 ring-black/[0.08]";
  const d = delivery.toLowerCase();
  if (d === "delivered") return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90";
  if (d === "bounced" || d === "failed") return "bg-red-100 text-red-950 ring-1 ring-red-200/90";
  if (d === "complained") return "bg-rose-100 text-rose-950 ring-1 ring-rose-200/90";
  if (d === "delayed") return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90";
  return "bg-black/[0.06] text-black/80 ring-1 ring-black/[0.1]";
}

export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Resend-style `email.*` webhook types → badge colors. */
export function emailWebhookEventBadgeClass(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes("delivered")) return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90";
  if (t.includes("bounced") || t.includes("failed")) return "bg-red-100 text-red-950 ring-1 ring-red-200/90";
  if (t.includes("complained")) return "bg-rose-100 text-rose-950 ring-1 ring-rose-200/90";
  if (t.includes("opened") || t.includes("clicked")) return "bg-sky-100 text-sky-950 ring-1 ring-sky-200/90";
  if (t.includes("delayed")) return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/90";
  if (t.includes("sent")) return "bg-violet-100 text-violet-950 ring-1 ring-violet-200/90";
  return "bg-black/[0.06] text-black/80 ring-1 ring-black/[0.1]";
}
