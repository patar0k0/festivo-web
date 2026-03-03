import { redirect } from "next/navigation";
import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

type AdminAuthContext = {
  supabase: SupabaseClient;
  client: SupabaseClient;
  user: User;
  isAdmin: true;
};

async function hasAdminRole(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    throw new Error(`user_roles lookup failed: ${error.message}`);
  }

  return Boolean(data);
}

async function getCurrentUser(client: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getAdminContext(): Promise<AdminAuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const user = await getCurrentUser(supabase);
  if (!user) {
    return null;
  }

  const isAdmin = await hasAdminRole(supabase, user.id);
  if (!isAdmin) {
    return null;
  }

  return { supabase, client: supabase, user, isAdmin: true };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) {
    return null;
  }

  const isAdmin = await hasAdminRole(client, user.id);

  return {
    userId: user.id,
    email: user.email ?? null,
    isAdmin,
  };
}

export async function requireAdmin() {
  try {
    const client = await createSupabaseServerClient();
    const user = await getCurrentUser(client);

    if (!user) {
      redirect("/login");
    }

    const isAdmin = await hasAdminRole(client, user.id);

    if (!isAdmin) {
      redirect("/");
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      isAdmin: true,
    };
  } catch {
    redirect("/");
  }
}
