import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type AdminAuditStatus = "success";

type AdminAuditActionInput = {
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  route?: string | null;
  method?: string | null;
  status?: AdminAuditStatus;
  details?: Record<string, unknown>;
};

async function insertAdminAuditRow(input: AdminAuditActionInput): Promise<void> {
  const admin = createSupabaseAdmin();
  const { error } = await admin.from("admin_audit_logs").insert({
    actor_user_id: input.actor_user_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    route: input.route ?? null,
    method: input.method ?? null,
    status: input.status ?? "success",
    details: input.details ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Best-effort audit write: logs failures, schedules one async retry; does not throw (action already completed).
 */
export async function logAdminAction(input: AdminAuditActionInput): Promise<void> {
  try {
    await insertAdminAuditRow(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin_audit_logs] insert failed", {
      action: input.action,
      entity_type: input.entity_type,
      message,
    });
    const payload = { ...input };
    setTimeout(() => {
      void insertAdminAuditRow(payload).catch((e2) => {
        const m2 = e2 instanceof Error ? e2.message : String(e2);
        console.error("[admin_audit_logs] async retry failed", {
          action: payload.action,
          entity_type: payload.entity_type,
          message: m2,
        });
      });
    }, 1600);
  }
}
