import type { SupabaseClient, User } from "@supabase/supabase-js";
import { providerKey } from "@/lib/admin/adminUsersList";

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

export type AdminUserDetail = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  provider: string;
  user_metadata: Record<string, unknown>;
  is_admin: boolean;
  organizer_memberships: AdminUserDetailOrganizerMembership[];
  plan_festivals_count: number;
  plan_reminders_count: number;
  device_tokens: AdminUserDetailDeviceToken[];
  notifications_count: number;
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

export function userIsBanned(user: { banned_until?: string | null }): boolean {
  const u = user.banned_until;
  if (!u) return false;
  return new Date(u) > new Date();
}

export function buildAdminUserDetail(
  user: User,
  extras: {
    is_admin: boolean;
    organizer_memberships: AdminUserDetailOrganizerMembership[];
    plan_festivals_count: number;
    plan_reminders_count: number;
    device_tokens: AdminUserDetailDeviceToken[];
    notifications_count: number;
  },
): AdminUserDetail {
  const meta = user.user_metadata;
  return {
    id: user.id,
    email: user.email ?? null,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    banned_until: user.banned_until ?? null,
    provider: providerKey(user),
    user_metadata: meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {},
    is_admin: extras.is_admin,
    organizer_memberships: extras.organizer_memberships,
    plan_festivals_count: extras.plan_festivals_count,
    plan_reminders_count: extras.plan_reminders_count,
    device_tokens: extras.device_tokens,
    notifications_count: extras.notifications_count,
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
    adminRoleRes,
    membersRes,
    planFestRes,
    planRemRes,
    tokensRes,
    notifRes,
  ] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    adminClient.from("user_roles").select("user_id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
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
  ]);

  if (authRes.error || !authRes.data?.user) {
    return null;
  }
  const user = authRes.data.user;

  if (adminRoleRes.error) {
    throw new Error(`user_roles: ${adminRoleRes.error.message}`);
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

  return buildAdminUserDetail(user, {
    is_admin: Boolean(adminRoleRes.data),
    organizer_memberships: memberships,
    plan_festivals_count: planFestRes.count ?? 0,
    plan_reminders_count: planRemRes.count ?? 0,
    device_tokens,
    notifications_count: notifRes.count ?? 0,
  });
}
