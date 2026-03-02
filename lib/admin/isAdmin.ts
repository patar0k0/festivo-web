import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { ACCESS_AUTH_COOKIE, REFRESH_AUTH_COOKIE, USER_AUTH_COOKIE } from "@/lib/authUser";
import { getSupabaseEnv, supabaseServer } from "@/lib/supabaseServer";
import { refreshAccessToken } from "@/lib/authRefresh";

export type AdminSession = {
  userId: string;
  email: string | null;
  isAdmin: boolean;
};

type AdminAuthContext = {
  client: SupabaseClient;
  user: User;
};

async function getTokensFromCookies() {
  const cookieStore = await cookies();

  return {
    accessToken:
      cookieStore.get(ACCESS_AUTH_COOKIE)?.value ??
      cookieStore.get(USER_AUTH_COOKIE)?.value ??
      null,
    refreshToken: cookieStore.get(REFRESH_AUTH_COOKIE)?.value ?? null,
  };
}

function createAuthedSupabase(accessToken: string) {
  const { url, anon, configured } = getSupabaseEnv();
  if (!configured || !url || !anon) {
    return null;
  }

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function getCurrentUser() {
  const { accessToken, refreshToken } = await getTokensFromCookies();

  const supabase = supabaseServer();
  if (!supabase) {
    return null;
  }

  if (accessToken) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (!error && user) {
      return { user, accessToken };
    }
  }

  if (!refreshToken) {
    return null;
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed?.access_token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(refreshed.access_token);

  if (error || !user) {
    return null;
  }

  return { user, accessToken: refreshed.access_token };
}

async function hasAdminRole(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

export async function getAdminContext(): Promise<AdminAuthContext | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return null;
  }

  const client = createAuthedSupabase(currentUser.accessToken);
  if (!client) {
    return null;
  }

  const isAdmin = await hasAdminRole(client, currentUser.user.id);
  if (!isAdmin) {
    return null;
  }

  return { client, user: currentUser.user };
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return null;
  }

  const client = createAuthedSupabase(currentUser.accessToken);
  if (!client) {
    return null;
  }

  const isAdmin = await hasAdminRole(client, currentUser.user.id);

  return {
    userId: currentUser.user.id,
    email: currentUser.user.email ?? null,
    isAdmin,
  };
}

export async function requireAdmin() {
  const session = await getAdminSession();

  if (!session) {
    redirect(`/admin/login?next=${encodeURIComponent("/admin")}`);
  }

  if (!session.isAdmin) {
    redirect("/");
  }

  return session;
}
