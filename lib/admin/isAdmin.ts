import { redirect } from "next/navigation";
import { type SupabaseClient, type User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

type AdminAuthContext = {
  client: SupabaseClient;
  user: User;
};

async function hasAdminRole(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    console.error("[admin] user_roles lookup failed", { userId, error });
    throw new Error(`user_roles lookup failed: ${error.message}`);
  }

  const isAdmin = Boolean(data);
  console.log("[admin] role lookup", { userId, isAdmin });
  return isAdmin;
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
  const client = await createSupabaseServerClient();
  const user = await getCurrentUser(client);
  if (!user) {
    return null;
  }

  const isAdmin = await hasAdminRole(client, user.id);
  if (!isAdmin) {
    return null;
  }

  return { client, user };
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
      console.log("[admin] requireAdmin no user");
      redirect("/login");
    }

    const isAdmin = await hasAdminRole(client, user.id);
    console.log("[admin] requireAdmin", { userId: user.id, isAdmin });

    if (!isAdmin) {
      redirect("/");
    }

    return {
      userId: user.id,
      email: user.email ?? null,
      isAdmin: true,
    };
  } catch (error) {
    console.error("[admin] requireAdmin failed", error);
    redirect("/");
  }
}
