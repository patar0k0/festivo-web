import Link from "next/link";
import FestivalEditForm from "@/components/admin/FestivalEditForm";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function AdminFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();

  if (!db) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">Липсва SUPABASE_SERVICE_ROLE_KEY за admin панела.</div>;
  }

  const { data, error } = await db
    .from("festivals")
    .select(
      "id,title,slug,category,city,region,address,start_date,end_date,image_url,website_url,ticket_url,price_range,lat,lng,is_free,is_verified,status,tags,description,source_url,source_type"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-black/60">
        Фестивалът не е намерен. <Link href="/admin/festivals" className="underline">Назад към списъка</Link>
      </div>
    );
  }

  return <FestivalEditForm festival={{ ...data, id: String(data.id) }} />;
}
