export type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
};

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!refreshToken || !supabaseUrl || !anonKey) {
    return null;
  }

  try {
    const refreshResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      },
    );

    if (!refreshResponse.ok) {
      return null;
    }

    const data: RefreshResponse = await refreshResponse.json();
    if (!data.access_token) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}
