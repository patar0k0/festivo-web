import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const ADMIN_AUTH_COOKIE = "festivo_admin_token";

export type AdminSession = {
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
};

async function isAdminUser(userId: string) {
  const adminDb = supabaseAdmin();
  const client = adminDb ?? supabaseServer();

  if (!client) {
    return false;
  }

  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function getAdminSession(): Promise<AdminSession> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_AUTH_COOKIE)?.value;

  if (!accessToken) {
    return { userId: null, email: null, isAdmin: false };
  }

  const supabase = supabaseServer();
  if (!supabase) {
    return { userId: null, email: null, isAdmin: false };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);

  if (!user) {
    return { userId: null, email: null, isAdmin: false };
  }

  const isAdmin = await isAdminUser(user.id);
  return { userId: user.id, email: user.email ?? null, isAdmin };
}

export async function requireAdmin() {
  const session = await getAdminSession();

  if (!session.isAdmin) {
    redirect("/admin/login");
  }

  return session;
}
