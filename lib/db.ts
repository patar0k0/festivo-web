import { supabaseServer } from "@/lib/supabaseServer";

export function db() {
  return supabaseServer();
}
