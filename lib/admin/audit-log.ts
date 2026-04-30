import { createHash } from "node:crypto";
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
  dedupe_key?: string;
};

function auditDedupeNonce(): string {
  const millis = Date.now().toString(36);
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .padStart(4, "0");
  return `${millis}-${random}`;
}

/** Hash(actor + entity_type + entity_id + action + microtime-random nonce) for idempotent retries. */
export function buildAdminAuditDedupeKey(input: AdminAuditActionInput): string {
  const nonce = auditDedupeNonce();
  const raw = [
    input.actor_user_id ?? "",
    input.entity_type,
    input.entity_id ?? "",
    input.action,
    nonce,
  ].join("|");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code?: string }).code;
    if (code === "23505") return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate key|unique constraint/i.test(msg);
}

async function insertAdminAuditRow(input: AdminAuditActionInput): Promise<void> {
  const admin = createSupabaseAdmin();
  const dedupe_key = input.dedupe_key ?? buildAdminAuditDedupeKey(input);
  const { error } = await admin.from("admin_audit_logs").insert({
    actor_user_id: input.actor_user_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    route: input.route ?? null,
    method: input.method ?? null,
    status: input.status ?? "success",
    details: input.details ?? {},
    dedupe_key,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Best-effort audit write: logs failures, schedules one async retry; does not throw (action already completed).
 * Duplicate dedupe_key is treated as success — avoids double logs on retry.
 */
export async function logAdminAction(input: AdminAuditActionInput): Promise<void> {
  const dedupe_key = input.dedupe_key ?? buildAdminAuditDedupeKey(input);
  const payload = { ...input, dedupe_key };
  try {
    await insertAdminAuditRow(payload);
  } catch (e) {
    if (isUniqueViolation(e)) {
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    console.error("[admin_audit_logs] insert failed", {
      action: payload.action,
      entity_type: payload.entity_type,
      message,
    });
    setTimeout(() => {
      void insertAdminAuditRow(payload).catch((e2) => {
        if (isUniqueViolation(e2)) {
          return;
        }
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
