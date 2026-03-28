import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

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
    .in("role", ["owner", "admin", "editor"]);

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
    .in("role", ["owner", "admin", "editor"])
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
