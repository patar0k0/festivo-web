import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const ADMIN_AUDIT_LOGS_PER_PAGE = 25;

export type AdminAuditLogRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  route: string | null;
  method: string | null;
  status: string;
  details: Record<string, unknown>;
};

export type AdminAuditLogsQueryInput = {
  page: number;
  action?: string;
  entity_type?: string;
  actor_user_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
};

export type AdminAuditLogsQueryResult = {
  rows: AdminAuditLogRow[];
  actorDisplayNames: Map<string, string | null>;
  total: number;
  page: number;
  perPage: number;
  error?: string;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function startOfUtcDay(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return `${isoDate}T00:00:00.000Z`;
}

function endOfUtcDay(isoDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  return `${isoDate}T23:59:59.999Z`;
}

function normalizeDetails(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function queryAdminAuditLogs(input: AdminAuditLogsQueryInput): Promise<AdminAuditLogsQueryResult> {
  const page = Math.max(1, input.page);
  const perPage = ADMIN_AUDIT_LOGS_PER_PAGE;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Admin client unavailable";
    return { rows: [], actorDisplayNames: new Map(), total: 0, page, perPage, error: message };
  }

  let q = admin
    .from("admin_audit_logs")
    .select("id, created_at, actor_user_id, action, entity_type, entity_id, route, method, status, details", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const action = input.action?.trim();
  if (action) {
    q = q.eq("action", action);
  }

  const entityType = input.entity_type?.trim();
  if (entityType) {
    q = q.eq("entity_type", entityType);
  }

  const actorId = input.actor_user_id?.trim();
  if (actorId && isUuid(actorId)) {
    q = q.eq("actor_user_id", actorId);
  }

  const df = input.date_from?.trim() ?? "";
  const dt = input.date_to?.trim() ?? "";
  const start = df ? startOfUtcDay(df) : null;
  const end = dt ? endOfUtcDay(dt) : null;
  if (start) {
    q = q.gte("created_at", start);
  }
  if (end) {
    q = q.lte("created_at", end);
  }

  const { data, error, count } = await q;

  if (error) {
    return {
      rows: [],
      actorDisplayNames: new Map(),
      total: 0,
      page,
      perPage,
      error: error.message,
    };
  }

  const rows: AdminAuditLogRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    created_at: String(row.created_at),
    actor_user_id: row.actor_user_id == null ? null : String(row.actor_user_id),
    action: String(row.action),
    entity_type: String(row.entity_type),
    entity_id: row.entity_id == null ? null : String(row.entity_id),
    route: row.route == null ? null : String(row.route),
    method: row.method == null ? null : String(row.method),
    status: String(row.status ?? "success"),
    details: normalizeDetails(row.details),
  }));

  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => Boolean(id)))];
  const actorDisplayNames = new Map<string, string | null>();

  if (actorIds.length > 0) {
    const { data: profiles, error: profErr } = await admin.from("profiles").select("user_id, display_name").in("user_id", actorIds);
    if (!profErr && profiles) {
      for (const p of profiles) {
        actorDisplayNames.set(String(p.user_id), p.display_name ?? null);
      }
    }
    for (const id of actorIds) {
      if (!actorDisplayNames.has(id)) {
        actorDisplayNames.set(id, null);
      }
    }
  }

  return {
    rows,
    actorDisplayNames,
    total: typeof count === "number" ? count : 0,
    page,
    perPage,
  };
}
