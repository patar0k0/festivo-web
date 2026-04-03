import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { EMAIL_JOB_KIND_TYPES, type EmailJobKindPreset } from "@/lib/admin/emailJobAdminDisplay";

export const ADMIN_EMAIL_JOBS_PER_PAGE = 40;

export type AdminEmailJobRow = {
  id: string;
  type: string;
  recipient_email: string;
  status: string;
  delivery_status: string | null;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  created_at: string;
  sent_at: string | null;
  last_event_type: string | null;
  last_event_at: string | null;
};

export type AdminEmailJobDetailRow = AdminEmailJobRow & {
  locale: string;
  payload: Record<string, unknown>;
  last_error: string | null;
  attempts: number;
  max_attempts: number;
  dedupe_key: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  updated_at: string;
  recipient_user_id: string | null;
};

export type AdminEmailEventRow = {
  id: string;
  event_type: string;
  occurred_at: string;
  provider_message_id: string | null;
  event_payload: Record<string, unknown>;
};

export type AdminEmailJobsSummary = {
  pending: number;
  failed: number;
  bounced: number;
  delivered: number;
  sentLast24h: number;
};

export type AdminEmailJobsListInput = {
  page: number;
  status?: string;
  delivery_status?: string;
  type?: string;
  kind?: EmailJobKindPreset | null;
  q?: string;
};

export type AdminEmailJobsListResult = {
  rows: AdminEmailJobRow[];
  total: number;
  page: number;
  perPage: number;
  error?: string;
};

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

function normalizeRow(r: Record<string, unknown>): AdminEmailJobRow {
  return {
    id: String(r.id),
    type: String(r.type),
    recipient_email: String(r.recipient_email),
    status: String(r.status),
    delivery_status: r.delivery_status == null ? null : String(r.delivery_status),
    subject: r.subject == null ? null : String(r.subject),
    provider: r.provider == null ? null : String(r.provider),
    provider_message_id: r.provider_message_id == null ? null : String(r.provider_message_id),
    created_at: String(r.created_at),
    sent_at: r.sent_at == null ? null : String(r.sent_at),
    last_event_type: r.last_event_type == null ? null : String(r.last_event_type),
    last_event_at: r.last_event_at == null ? null : String(r.last_event_at),
  };
}

export async function fetchAdminEmailJobsSummary(admin: SupabaseClient): Promise<{
  summary: AdminEmailJobsSummary;
  error?: string;
}> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: pending, error: e1 },
    { count: failed, error: e2 },
    { count: bounced, error: e3 },
    { count: delivered, error: e4 },
    { count: sentLast24h, error: e5 },
  ] = await Promise.all([
    admin.from("email_jobs").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("email_jobs").select("*", { count: "exact", head: true }).eq("status", "failed"),
    admin.from("email_jobs").select("*", { count: "exact", head: true }).eq("delivery_status", "bounced"),
    admin.from("email_jobs").select("*", { count: "exact", head: true }).eq("delivery_status", "delivered"),
    admin.from("email_jobs").select("*", { count: "exact", head: true }).not("sent_at", "is", null).gte("sent_at", since24h),
  ]);

  const err = e1 ?? e2 ?? e3 ?? e4 ?? e5;
  if (err) {
    return {
      summary: { pending: 0, failed: 0, bounced: 0, delivered: 0, sentLast24h: 0 },
      error: err.message,
    };
  }

  return {
    summary: {
      pending: pending ?? 0,
      failed: failed ?? 0,
      bounced: bounced ?? 0,
      delivered: delivered ?? 0,
      sentLast24h: sentLast24h ?? 0,
    },
  };
}

export async function queryAdminEmailJobsList(input: AdminEmailJobsListInput): Promise<AdminEmailJobsListResult> {
  const page = Math.max(1, input.page);
  const perPage = ADMIN_EMAIL_JOBS_PER_PAGE;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Admin client unavailable";
    return { rows: [], total: 0, page, perPage, error: message };
  }

  let q = admin
    .from("email_jobs")
    .select(
      "id, type, recipient_email, status, delivery_status, subject, provider, provider_message_id, created_at, sent_at, last_event_type, last_event_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const typeFilter = input.type?.trim();
  if (typeFilter) {
    q = q.eq("type", typeFilter);
  } else if (input.kind) {
    const types = [...EMAIL_JOB_KIND_TYPES[input.kind]];
    q = q.in("type", types);
  }

  const st = input.status?.trim();
  if (st) {
    q = q.eq("status", st);
  }

  const ds = input.delivery_status?.trim();
  if (ds) {
    q = q.eq("delivery_status", ds);
  }

  const rawQ = input.q?.trim();
  if (rawQ) {
    const safe = escapeIlikePattern(rawQ).replace(/,/g, "");
    const pattern = `%${safe}%`;
    q = q.or(
      `recipient_email.ilike.${pattern},subject.ilike.${pattern},type.ilike.${pattern},provider_message_id.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await q;

  if (error) {
    return { rows: [], total: 0, page, perPage, error: error.message };
  }

  const rows = (data ?? []).map((row) => normalizeRow(row as Record<string, unknown>));
  return {
    rows,
    total: typeof count === "number" ? count : 0,
    page,
    perPage,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export async function fetchAdminEmailJobDetail(
  id: string,
): Promise<{ row: AdminEmailJobDetailRow | null; error?: string }> {
  if (!isUuid(id)) {
    return { row: null };
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Admin client unavailable";
    return { row: null, error: message };
  }

  const { data, error } = await admin
    .from("email_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { row: null, error: error.message };
  }
  if (!data) {
    return { row: null };
  }

  const r = data as Record<string, unknown>;
  const payload = r.payload && typeof r.payload === "object" && !Array.isArray(r.payload) ? (r.payload as Record<string, unknown>) : {};

  const row: AdminEmailJobDetailRow = {
    ...normalizeRow(r),
    locale: String(r.locale ?? "bg"),
    payload,
    last_error: r.last_error == null ? null : String(r.last_error),
    attempts: Number(r.attempts ?? 0),
    max_attempts: Number(r.max_attempts ?? 0),
    dedupe_key: r.dedupe_key == null ? null : String(r.dedupe_key),
    delivered_at: r.delivered_at == null ? null : String(r.delivered_at),
    bounced_at: r.bounced_at == null ? null : String(r.bounced_at),
    updated_at: String(r.updated_at ?? r.created_at),
    recipient_user_id: r.recipient_user_id == null ? null : String(r.recipient_user_id),
  };

  return { row };
}

export async function fetchAdminEmailEventsForJob(
  emailJobId: string,
): Promise<{ rows: AdminEmailEventRow[]; error?: string }> {
  if (!isUuid(emailJobId)) {
    return { rows: [] };
  }

  let admin: SupabaseClient;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Admin client unavailable";
    return { rows: [], error: message };
  }

  const { data, error } = await admin
    .from("email_events")
    .select("id, event_type, occurred_at, provider_message_id, event_payload")
    .eq("email_job_id", emailJobId)
    .order("occurred_at", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows: AdminEmailEventRow[] = (data ?? []).map((ev) => {
    const e = ev as Record<string, unknown>;
    const ep =
      e.event_payload && typeof e.event_payload === "object" && !Array.isArray(e.event_payload)
        ? (e.event_payload as Record<string, unknown>)
        : {};
    return {
      id: String(e.id),
      event_type: String(e.event_type),
      occurred_at: String(e.occurred_at),
      provider_message_id: e.provider_message_id == null ? null : String(e.provider_message_id),
      event_payload: ep,
    };
  });

  return { rows };
}
