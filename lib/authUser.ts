import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OptionalUser = {
  id: string;
  email: string | null;
} | null;

export async function getOptionalUser(): Promise<OptionalUser> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}
