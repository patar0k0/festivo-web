import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalsTable from "@/components/admin/PendingFestivalsTable";
import { assessPendingFestivalQuality, type PendingQualityBucket } from "@/lib/admin/pendingFestivalQuality";

export type PendingFestivalRow = {
  id: string;
  title: string;
  description: string | null;
  city_id: number | null;
  city_guess: string | null;
  location_name: string | null;
  location_guess: string | null;
  organizer_name: string | null;
  hero_image: string | null;
  category: string | null;
  tags: unknown;
  date_guess: string | null;
  start_date: string | null;
  end_date: string | null;
  source_url: string | null;
  created_at: string;
  quality_score: number;
  quality_bucket: PendingQualityBucket;
  missing_fields: string[];
};

function asSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AdminPendingFestivalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/pending-festivals");
  }

  const params = await searchParams;
  const approved = asSearchParam(params.approved) === "1";
  const rejected = asSearchParam(params.rejected) === "1";
  const festivalId = asSearchParam(params.festival_id);
  const qualityFilter = asSearchParam(params.quality) as PendingQualityBucket | "";

  const initialMessage = approved
    ? festivalId
      ? `Festival approved and published (festival_id: ${festivalId}).`
      : "Festival approved and published."
    : rejected
      ? "Festival rejected."
      : "";

  const { data, error } = await ctx.supabase
    .from("pending_festivals")
    .select("id,title,description,city_id,city_guess,location_name,location_guess,organizer_name,hero_image,category,tags,date_guess,start_date,end_date,source_url,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  const rows: PendingFestivalRow[] = (data ?? []).map((row) => {
    const quality = assessPendingFestivalQuality(row);
    return {
      id: String(row.id),
      title: row.title ?? "(untitled)",
      description: row.description ?? null,
      city_id: row.city_id ?? null,
      city_guess: row.city_guess ?? null,
      location_name: row.location_name ?? null,
      location_guess: row.location_guess ?? null,
      organizer_name: row.organizer_name ?? null,
      hero_image: row.hero_image ?? null,
      category: row.category ?? null,
      tags: row.tags,
      date_guess: row.date_guess ?? null,
      start_date: row.start_date ?? null,
      end_date: row.end_date ?? null,
      source_url: row.source_url ?? null,
      created_at: row.created_at,
      quality_score: quality.quality_score,
      quality_bucket: quality.quality_bucket,
      missing_fields: quality.missing_fields,
    };
  });

  const filteredRows = qualityFilter ? rows.filter((row) => row.quality_bucket === qualityFilter) : rows;

  const qualityCounts = rows.reduce<Record<PendingQualityBucket, number>>(
    (acc, row) => {
      acc[row.quality_bucket] += 1;
      return acc;
    },
    { ready: 0, needs_fix: 0, weak: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <h1 className="text-3xl font-black tracking-tight">Pending Festivals</h1>
        <p className="mt-2 text-sm text-black/65">Review incoming ingestion records before publishing them to the main festivals catalog.</p>
      </div>

      <PendingFestivalsTable rows={filteredRows} initialMessage={initialMessage} qualityFilter={qualityFilter} qualityCounts={qualityCounts} />
    </div>
  );
}
