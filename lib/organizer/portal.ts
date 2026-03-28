import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const PORTAL_MEMBER_ROLES = ["owner", "admin", "editor"] as const;

export type OrganizerMemberRow = {
  id: string;
  organizer_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export async function getPortalSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) return null;
  return { supabase, user };
}

export function getPortalAdminClient() {
  return createSupabaseAdmin();
}

export async function fetchActiveMembershipOrganizerIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from("organizer_members")
    .select("organizer_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", [...PORTAL_MEMBER_ROLES]);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((r) => r.organizer_id).filter(Boolean);
  return [...new Set(ids)];
}

export async function hasActiveOrganizerMembership(
  admin: SupabaseClient,
  userId: string,
  organizerId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("organizer_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organizer_id", organizerId)
    .eq("status", "active")
    .in("role", [...PORTAL_MEMBER_ROLES])
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data?.id);
}

export type PortalPendingRow = {
  id: string;
  status: string;
  organizer_id: string | null;
  submission_source: string | null;
  submitted_by_user_id: string | null;
};

export async function loadPortalPendingFestival(admin: SupabaseClient, pendingId: string): Promise<PortalPendingRow | null> {
  const { data, error } = await admin
    .from("pending_festivals")
    .select("id,status,organizer_id,submission_source,submitted_by_user_id")
    .eq("id", pendingId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as PortalPendingRow | null;
}

export async function assertCanEditOrganizerPending(admin: SupabaseClient, userId: string, pending: PortalPendingRow) {
  if (pending.status !== "pending") {
    return { ok: false as const, error: "Редакция е възможна само за чакащи записи." };
  }

  if (pending.submission_source !== "organizer_portal" || !pending.organizer_id) {
    return { ok: false as const, error: "Нямате права за този запис." };
  }

  const allowed = await hasActiveOrganizerMembership(admin, userId, pending.organizer_id);
  if (!allowed) {
    return { ok: false as const, error: "Нямате права за този запис." };
  }

  return { ok: true as const };
}

export type OrganizerPortalMembershipSummary = {
  activeOrganizerIds: string[];
  hasPendingMembership: boolean;
  hasRevokedMembership: boolean;
};

export async function fetchOrganizerPortalMembershipSummary(
  admin: SupabaseClient,
  userId: string,
): Promise<OrganizerPortalMembershipSummary> {
  const { data, error } = await admin
    .from("organizer_members")
    .select("organizer_id,status")
    .eq("user_id", userId)
    .in("role", [...PORTAL_MEMBER_ROLES]);

  if (error) {
    throw new Error(error.message);
  }

  const rows = data ?? [];
  const activeOrganizerIds = [
    ...new Set(
      rows
        .filter((r) => r.status === "active")
        .map((r) => r.organizer_id as string)
        .filter(Boolean),
    ),
  ];
  const hasPendingMembership = rows.some((r) => r.status === "pending");
  const hasRevokedMembership = rows.some((r) => r.status === "revoked");

  return { activeOrganizerIds, hasPendingMembership, hasRevokedMembership };
}

export type ActiveOrganizerPortalGate =
  | { kind: "redirect"; to: string }
  | { kind: "unavailable" }
  | { kind: "ok"; admin: SupabaseClient; userId: string; orgIds: string[] };

export async function requireActiveOrganizerPortalSession(loginNextPath: string): Promise<ActiveOrganizerPortalGate> {
  const session = await getPortalSessionUser();
  if (!session?.user?.id) {
    return { kind: "redirect", to: `/login?next=${encodeURIComponent(loginNextPath)}` };
  }

  let admin: SupabaseClient;
  try {
    admin = getPortalAdminClient();
  } catch {
    return { kind: "unavailable" };
  }

  const orgIds = await fetchActiveMembershipOrganizerIds(admin, session.user.id);
  if (orgIds.length === 0) {
    return { kind: "redirect", to: "/organizer" };
  }

  return { kind: "ok", admin, userId: session.user.id, orgIds };
}
