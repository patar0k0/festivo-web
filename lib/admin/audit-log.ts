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

export async function logAdminAction(input: AdminAuditActionInput) {
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
