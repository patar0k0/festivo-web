import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRole) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  if (!url) {
    throw new Error("Missing SUPABASE_URL");
  }

  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function supabaseAdmin() {
  try {
    return createSupabaseAdmin();
  } catch {
    return null;
  }
}
