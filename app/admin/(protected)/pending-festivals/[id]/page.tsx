import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalEditForm, { type PendingFestivalRecord } from "@/components/admin/PendingFestivalEditForm";
import { assessPendingFestivalQuality } from "@/lib/admin/pendingFestivalQuality";

type PendingFestivalCityRelation = {
  id: number;
  name_bg: string | null;
  slug: string | null;
};

function normalizePendingFestivalData(data: unknown): PendingFestivalRecord | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as PendingFestivalRecord;
}

function normalizeCityRelation(city: unknown): PendingFestivalCityRelation | null {
  if (!city) {
    return null;
  }

  const candidate = Array.isArray(city) ? city[0] : city;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const id = "id" in candidate ? candidate.id : null;
  if (typeof id !== "number") {
    return null;
  }

  return {
    id,
    name_bg: "name_bg" in candidate && typeof candidate.name_bg === "string" ? candidate.name_bg : null,
    slug: "slug" in candidate && typeof candidate.slug === "string" ? candidate.slug : null,
  };
}

export default async function AdminPendingFestivalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect(`/login?next=/admin/pending-festivals/${id}`);
  }

  const { data, error } = await ctx.supabase.from("pending_festivals").select("*,city:cities(id,name_bg,slug)").eq("id", id).maybeSingle();

  if (error) {
    return <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">{error.message}</div>;
  }

  if (!data) {
    notFound();
  }

  const pendingFestivalData = normalizePendingFestivalData(data);
  if (!pendingFestivalData) {
    return (
      <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-sm text-[#b13a1a]">
        Unexpected pending festival payload shape.
      </div>
    );
  }

  const pendingFestival = {
    ...pendingFestivalData,
    id: String(pendingFestivalData.id),
    city: normalizeCityRelation(pendingFestivalData.city),
  };

  const qualityDiagnostics = assessPendingFestivalQuality(pendingFestival);

  let lastIngestJobMeta: {
    status: string;
    fb_browser_context: "authenticated" | "anonymous" | null;
    finished_at: string | null;
  } | null = null;

  const sourceUrlForIngest = typeof pendingFestival.source_url === "string" ? pendingFestival.source_url.trim() : "";
  if (sourceUrlForIngest) {
    const { data: ingestJob, error: ingestJobError } = await ctx.supabase
      .from("ingest_jobs")
      .select("status,fb_browser_context,finished_at")
      .eq("source_url", sourceUrlForIngest)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!ingestJobError && ingestJob && typeof ingestJob.status === "string") {
      const fb = ingestJob.fb_browser_context;
      lastIngestJobMeta = {
        status: ingestJob.status,
        fb_browser_context: fb === "authenticated" || fb === "anonymous" ? fb : null,
        finished_at: typeof ingestJob.finished_at === "string" ? ingestJob.finished_at : null,
      };
    }
  }

  return (
    <PendingFestivalEditForm
      pendingFestival={pendingFestival}
      qualityDiagnostics={qualityDiagnostics}
      lastIngestJobMeta={lastIngestJobMeta}
    />
  );
}
