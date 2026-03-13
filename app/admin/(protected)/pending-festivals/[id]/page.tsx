import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import PendingFestivalEditForm, { type PendingFestivalRecord } from "@/components/admin/PendingFestivalEditForm";

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

  const baseSelectFields =
    "id,title,slug,description,city_id,location_name,address,website_url,ticket_url,price_range,category,region,source_type,latitude,longitude,start_date,end_date,organizer_name,source_url,is_free,hero_image,status,created_at,reviewed_at,reviewed_by,title_clean,description_clean,description_short,category_guess,tags_guess,tags,city_guess,location_guess,date_guess,is_free_guess,normalization_version,deterministic_guess_json,ai_guess_json,merge_decisions_json,latitude_guess,longitude_guess,lat_guess,lng_guess,city:cities(id,name_bg,slug)";
  const heroDiagnosticsSelectFields = `${baseSelectFields},hero_image_source,hero_image_original_url,hero_image_score`;

  const runSelect = (fields: string) =>
    ctx.supabase.from("pending_festivals").select(fields).eq("id", id).maybeSingle();

  let { data, error } = await runSelect(heroDiagnosticsSelectFields);

  const errorMessage = error?.message?.toLocaleLowerCase("en-US") ?? "";
  const maybeMissingHeroDiagnosticsColumns =
    error?.code === "42703" ||
    errorMessage.includes("hero_image_source") ||
    errorMessage.includes("hero_image_original_url") ||
    errorMessage.includes("hero_image_score");

  if (error && maybeMissingHeroDiagnosticsColumns) {
    ({ data, error } = await runSelect(baseSelectFields));
  }

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

  return <PendingFestivalEditForm pendingFestival={pendingFestival} />;
}
