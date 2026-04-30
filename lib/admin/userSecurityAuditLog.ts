import { logAdminAction } from "@/lib/admin/audit-log";

export type UserSecurityAuditAction =
  | "user_soft_delete"
  | "user_hard_delete"
  | "user_restore"
  | "user_role_change"
  | "user_force_logout"
  | "user_reset_password"
  | "user_ban";

/** Maps to `admin_audit_logs`: entity_type `user`, entity_id = target user. */
export async function logUserSecurityAudit(input: {
  actorUserId: string;
  targetUserId: string;
  action: UserSecurityAuditAction;
  route: string;
  method: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await logAdminAction({
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: "user",
    entity_id: input.targetUserId,
    route: input.route,
    method: input.method,
    details: input.metadata ?? {},
  });
}
