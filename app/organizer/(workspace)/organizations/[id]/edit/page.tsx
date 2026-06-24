import Link from "next/link";
import { redirect } from "next/navigation";
import OrganizerProfileEditForm from "@/components/organizer/OrganizerProfileEditForm";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { fixMojibakeBG } from "@/lib/text/fixMojibake";

export const dynamic = "force-dynamic";

type OrganizerEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrganizerEditPage({ params }: OrganizerEditPageProps) {
  const { id } = await params;
  const gate = await requireOrganizerOwnerPortalSession(`/organizer/organizations/${id}/edit`);

  if (gate.kind === "redirect") {
    redirect(gate.to);
  }
  if (gate.kind === "unavailable") {
    return (
      <div className="rounded-2xl border border-amber-200/55 bg-amber-50/70 px-5 py-6 text-sm text-amber-950/85 shadow-sm">
        Услугата е временно недостъпна. Опитайте по-късно.
      </div>
    );
  }

  if (!gate.orgIds.includes(id)) {
    redirect("/organizer");
  }

  const { admin } = gate;
  const { data: organizer, error: organizerError } = await admin
    .from("organizers")
    .select(
      "id,slug,name,description,logo_url,website_url,facebook_url,instagram_url,email,phone,city_id",
    )
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (organizerError) {
    console.error("[organizer/organizations/[id]/edit] load organizer failed", organizerError.message);
    throw new Error(organizerError.message);
  }

  if (!organizer) {
    redirect("/organizer");
  }

  const currentCityId =
    organizer.city_id != null && Number.isFinite(Number(organizer.city_id)) ? Number(organizer.city_id) : null;

  const [cityRes, festivalCountRes] = await Promise.all([
    currentCityId != null
      ? admin.from("cities").select("id,name_bg").eq("id", currentCityId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("festivals")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", id)
      .in("status", ["verified", "published"]),
  ]);

  let initialCity: { id: number; name_bg: string } | null = null;
  if (currentCityId != null) {
    const { data: cityRow, error: cityError } = cityRes;
    if (cityError) {
      console.error("[organizer/organizations/[id]/edit] load city failed", cityError.message);
    } else if (cityRow && typeof cityRow.name_bg === "string") {
      initialCity = { id: cityRow.id as number, name_bg: fixMojibakeBG(cityRow.name_bg.trim()) };
    }
  }

  if (festivalCountRes.error) {
    console.error("[organizer/organizations/[id]/edit] load festival count failed", festivalCountRes.error.message);
  }

  const festivalCount = festivalCountRes.count ?? 0;

  const organizerName = organizer.name ?? "Организатор";
  const publicSlug = organizer.slug ?? "";

  return (
    <div className="space-y-6">
      {/* ── Back link ─────────────────────────────── */}
      <Link
        href="/organizer/dashboard"
        className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-black/55 transition-colors hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
      >
        <span aria-hidden="true">←</span> Назад към таблото
      </Link>

      {/* ── Header card ───────────────────────────── */}
      <header className="rounded-2xl border border-amber-200/55 bg-gradient-to-br from-amber-50/55 via-white to-white/95 p-5 shadow-sm ring-1 ring-amber-100/40 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c2d12]">
              Профил на организатор
            </p>
            <h1 className="mt-2 truncate font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              {organizerName}
            </h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-black/65">
              Това е публичният профил, който виждат посетителите. Промените се
              запазват автоматично докато пишеш.
            </p>
          </div>
          {publicSlug ? (
            <Link
              href={`/organizers/${publicSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-2.5 text-xs font-semibold text-emerald-900 transition-all duration-150 hover:bg-emerald-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
            >
              🔗 Виж публичния профил →
            </Link>
          ) : null}
        </div>
      </header>

      <OrganizerProfileEditForm
        organizerId={id}
        initialCity={initialCity}
        festivalCount={festivalCount}
        initial={{
          name: organizer.name ?? "",
          description: organizer.description ?? "",
          logo_url: organizer.logo_url ?? "",
          website_url: organizer.website_url ?? "",
          facebook_url: organizer.facebook_url ?? "",
          instagram_url: organizer.instagram_url ?? "",
          email: organizer.email ?? "",
          phone: organizer.phone ?? "",
          city_id: currentCityId,
        }}
      />
    </div>
  );
}
