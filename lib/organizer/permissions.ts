import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertCanEditOrganizer(admin: SupabaseClient, userId: string, organizerId: string) {
  const { data, error } = await admin
    .from("organizer_members")
    .select("id")
    .eq("user_id", userId)
    .eq("organizer_id", organizerId)
    .eq("status", "active")
    .eq("role", "owner")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    const forbiddenError = new Error("FORBIDDEN");
    forbiddenError.name = "OrganizerPermissionError";
    throw forbiddenError;
  }
}
