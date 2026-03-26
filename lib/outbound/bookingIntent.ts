import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Booking outbound clicks for one festival in the last 30 days (server-only; service role). */
export async function countBookingOutboundClicksLast30Days(festivalId: string): Promise<number> {
  const admin = supabaseAdmin();
  if (!admin) return 0;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const { count } = await admin
    .from("outbound_clicks")
    .select("*", { count: "exact", head: true })
    .eq("festival_id", festivalId)
    .eq("destination_type", "booking")
    .gte("created_at", since.toISOString());

  return count ?? 0;
}
