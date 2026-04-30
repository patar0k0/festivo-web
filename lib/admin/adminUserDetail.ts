import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/admin/appRoles";
import { isStaffAdminRole } from "@/lib/admin/appRoles";
import { providerKey } from "@/lib/admin/adminUsersList";
import { isUserInSweepRetryQueue } from "@/lib/admin/userSweepRetryQueue";
import {
  effectiveBannedUntilForDisplay,
  isUserBannedFromEitherSource,
} from "@/lib/admin/userBanEffective";

const AUTH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAuthUserId(id: string): boolean {
  return AUTH_UUID_RE.test(id);
}

export type AdminUserDetailOrganizerMembership = {
  id: string;
  organizer_id: string;
  organizer_name: string;
  organizer_slug: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

export type AdminUserDetailDeviceToken = {
  platform: string | null;
  created_at: string | null;
  invalidated_at: string | null;
};

export type AdminUserAuditEntry = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  route: string | null;
};

export type AdminUserDetail = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  /** Display: DB mirror when set, else Auth JWT. */
  banned_until: string | null;
  /** Either source indicates active ban (middleware-equivalent). */
  banned_active: boolean;
  provider: string;
  user_metadata: Record<string, unknown>;
  is_admin: boolean;
  app_role: AppRole;
  deleted_at: string | null;
  cleanup_pending: boolean;
  sweep_retry_pending: boolean;
  organizer_memberships: AdminUserDetailOrganizerMembership[];
  plan_festivals_count: number;
  plan_reminders_count: number;
  device_tokens: AdminUserDetailDeviceToken[];
  notifications_count: number;
  recent_audit: AdminUserAuditEntry[];
};

type OrganizerEmbed = { id?: string; name?: string | null; slug?: string | null } | null;

function mapMembershipRow(row: {
  id: string;
  organizer_id: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  organizer: OrganizerEmbed | OrganizerEmbed[];
}): AdminUserDetailOrganizerMembership {
  const orgRaw = row.organizer;
  const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
  return {
    id: row.id,
    organizer_id: row.organizer_id,
    organizer_name: org?.name?.trim() ? org.name : "—",
    organizer_slug: org?.slug ?? null,
    role: row.role,
    status: row.status,
    created_at: row.created_at,
    approved_at: row.approved_at,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
  };
}

export function userIsBanned(user: { banned_until?: string | null; banned_active?: boolean }): boolean {
  if (typeof user.banned_active === "boolean") return user.banned_active;
  const u = user.banned_until;
  if (!u) return false;
  return new Date(u) > new Date();
}

export function buildAdminUserDetail(
  user: User,
  extras: {
    is_admin: boolean;
    app_role: AppRole;
    deleted_at: string | null;
    banned_until_db: string | null;
    cleanup_pending: boolean;
    sweep_retry_pending: boolean;
    organizer_memberships: AdminUserDetailOrganizerMembership[];
    plan_festivals_count: number;
    plan_reminders_count: number;
    device_tokens: AdminUserDetailDeviceToken[];
    notifications_count: number;
    recent_audit: AdminUserAuditEntry[];
  },
): AdminUserDetail {
  const meta = user.user_metadata;
  const authBan = user.banned_until ?? null;
  const dbBan = extras.banned_until_db;
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: effectiveBannedUntilForDisplay(dbBan, authBan),
    banned_active: isUserBannedFromEitherSource(dbBan, authBan),
    provider: providerKey(user),
    user_metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {},
    is_admin: extras.is_admin,
    app_role: extras.app_role,
    deleted_at: extras.deleted_at,
    cleanup_pending: extras.cleanup_pending,
    sweep_retry_pending: extras.sweep_retry_pending,
    organizer_memberships: extras.organizer_memberships,
    plan_festivals_count: extras.plan_festivals_count,
    plan_reminders_count: extras.plan_reminders_count,
    device_tokens: extras.device_tokens,
    notifications_count: extras.notifications_count,
    recent_audit: extras.recent_audit,
  };
}

/**
 * Loads admin user detail via service-role client. Auth user + DB reads in one Promise.all.
 */
export async function fetchAdminUserDetail(adminClient: SupabaseClient, userId: string): Promise<AdminUserDetail | null> {
  if (!isAuthUserId(userId)) {
    return null;
  }

  const [
    authRes,
    roleRes,
    usersRowRes,
    membersRes,
    planFestRes,
    planRemRes,
    tokensRes,
    notifRes,
    auditRes,
    sweep_retry_pending,
  ] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    adminClient.from("user_roles").select("user_id,role").eq("user_id", userId).maybeSingle(),
    adminClient
      .from("users")
      .select("deleted_at, banned_until, cleanup_pending")
      .eq("id", userId)
      .maybeSingle(),
    adminClient
      .from("organizer_members")
      .select(
        "id, organizer_id, role, status, created_at, approved_at, contact_email, contact_phone, organizer:organizers(id, name, slug)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient.from("user_plan_festivals").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient.from("user_plan_reminders").select("user_id", { count: "exact", head: true }).eq("user_id", userId),
    adminClient
      .from("device_tokens")
      .select("platform, created_at, invalidated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("sent_at", "is", null),
    adminClient
      .from("admin_audit_logs")
      .select("id, created_at, action, entity_type, entity_id, route")
      .eq("actor_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12),
    isUserInSweepRetryQueue(adminClient, userId),
  ]);

  if (authRes.error || !authRes.data?.user) {
    return null;
  }
  const user = authRes.data.user;

  if (roleRes.error) {
    throw new Error(`user_roles: ${roleRes.error.message}`);
  }
  if (usersRowRes.error) {
    throw new Error(`users: ${usersRowRes.error.message}`);
  }
  if (membersRes.error) {
    throw new Error(`organizer_members: ${membersRes.error.message}`);
  }
  if (planFestRes.error) {
    throw new Error(`user_plan_festivals: ${planFestRes.error.message}`);
  }
  if (planRemRes.error) {
    throw new Error(`user_plan_reminders: ${planRemRes.error.message}`);
  }
  if (tokensRes.error) {
    throw new Error(`device_tokens: ${tokensRes.error.message}`);
  }
  if (notifRes.error) {
    throw new Error(`user_notifications: ${notifRes.error.message}`);
  }
  if (auditRes.error) {
    throw new Error(`admin_audit_logs: ${auditRes.error.message}`);
  }

  const usersRow = usersRowRes.data as {
    deleted_at?: string | null;
    banned_until?: string | null;
    cleanup_pending?: boolean | null;
  } | null;
  const deleted_at = usersRow?.deleted_at ?? null;
  const banned_until_db = usersRow?.banned_until ?? null;
  const cleanup_pending = Boolean(usersRow?.cleanup_pending);

  const roleRow = roleRes.data as { role?: string } | null;
  const rawRole = roleRow?.role ? String(roleRow.role) : "";
  const app_role: AppRole =
    rawRole === "organizer" || rawRole === "admin" || rawRole === "super_admin" || rawRole === "user"
      ? rawRole
      : "user";
  const is_admin = isStaffAdminRole(app_role);

  const memberships = (membersRes.data ?? []).map((row) =>
    mapMembershipRow(
      row as {
        id: string;
        organizer_id: string;
        role: string;
        status: string;
        created_at: string;
        approved_at: string | null;
        contact_email: string | null;
        contact_phone: string | null;
        organizer: OrganizerEmbed | OrganizerEmbed[];
      },
    ),
  );

  const device_tokens: AdminUserDetailDeviceToken[] = (tokensRes.data ?? []).map((t) => ({
    platform: t.platform ?? null,
    created_at: (t as { created_at?: string | null }).created_at ?? null,
    invalidated_at: t.invalidated_at ?? null,
  }));

  const recent_audit: AdminUserAuditEntry[] = (auditRes.data ?? []).map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    action: row.action as string,
    entity_type: row.entity_type as string,
    entity_id: (row.entity_id as string | null) ?? null,
    route: (row.route as string | null) ?? null,
  }));

  return buildAdminUserDetail(user, {
    is_admin,
    app_role,
    deleted_at,
    banned_until_db,
    cleanup_pending,
    sweep_retry_pending,
    organizer_memberships: memberships,
    plan_festivals_count: planFestRes.count ?? 0,
    plan_reminders_count: planRemRes.count ?? 0,
    device_tokens,
    notifications_count: notifRes.count ?? 0,
    recent_audit,
  });
}
