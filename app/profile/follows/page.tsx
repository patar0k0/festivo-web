import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getOptionalUser } from "@/lib/authUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FollowCityButton from "@/components/follow/FollowCityButton";
import FollowOrganizerButton from "@/components/follow/FollowOrganizerButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Любими градове и организатори | Festivo",
  robots: { index: false, follow: false },
};

type CityItem = { slug: string; name: string };
type OrganizerItem = { id: string; name: string; slug: string | null };

export default async function ProfileFollowsPage() {
  noStore();
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.06] bg-white/90 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Любими</h1>
          <p className="mt-2 text-sm text-black/55">Влез, за да управляваш следваните градове и организатори.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white"
            >
              Вход
            </Link>
            <Link
              href="/signup"
              className="inline-flex rounded-xl border border-black/[0.12] bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c0e14]"
            >
              Регистрация
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();

  const [cityFollowsRes, orgFollowsRes] = await Promise.all([
    supabase.from("user_followed_cities").select("city_slug").eq("user_id", user.id),
    supabase.from("user_followed_organizers").select("organizer_id").eq("user_id", user.id),
  ]);

  const citySlugs = [
    ...new Set(((cityFollowsRes.data ?? []) as { city_slug: string | null }[]).map((r) => r.city_slug).filter((s): s is string => Boolean(s))),
  ];
  const organizerIds = [
    ...new Set(((orgFollowsRes.data ?? []) as { organizer_id: string | null }[]).map((r) => r.organizer_id).filter((s): s is string => Boolean(s))),
  ];

  const [citiesRes, organizersRes] = await Promise.all([
    citySlugs.length
      ? supabase.from("cities").select("slug,name_bg").in("slug", citySlugs)
      : Promise.resolve({ data: [] as { slug: string; name_bg: string | null }[] }),
    organizerIds.length
      ? supabase.from("organizers").select("id,name,slug").in("id", organizerIds)
      : Promise.resolve({ data: [] as { id: string; name: string | null; slug: string | null }[] }),
  ]);

  const cityNameBySlug = new Map<string, string>();
  for (const row of (citiesRes.data ?? []) as { slug: string; name_bg: string | null }[]) {
    cityNameBySlug.set(row.slug, row.name_bg?.trim() || row.slug);
  }
  const cities: CityItem[] = citySlugs
    .map((slug) => ({ slug, name: cityNameBySlug.get(slug) ?? slug }))
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  const organizerById = new Map<string, { name: string; slug: string | null }>();
  for (const row of (organizersRes.data ?? []) as { id: string; name: string | null; slug: string | null }[]) {
    organizerById.set(row.id, { name: row.name?.trim() || "Организатор", slug: row.slug });
  }
  const organizers: OrganizerItem[] = organizerIds
    .map((id) => ({ id, name: organizerById.get(id)?.name ?? "Организатор", slug: organizerById.get(id)?.slug ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  return (
    <div className="min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <div>
          <Link href="/profile" className="text-xs font-semibold uppercase tracking-[0.15em] text-black/45 hover:text-black/70">
            ← Профил
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Любими</h1>
          <p className="mt-1 text-sm text-black/55">
            Събери любимите си градове и организатори на едно място.
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">📍 Градове</h2>
            <span className="text-xs font-medium text-black/45">{cities.length}</span>
          </header>
          {cities.length ? (
            <ul className="divide-y divide-black/[0.05]">
              {cities.map((city) => (
                <li key={city.slug} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <Link href={`/cities/${encodeURIComponent(city.slug)}`} className="min-w-0 truncate text-sm font-medium text-[#0c0e14] hover:underline">
                    {city.name}
                  </Link>
                  <FollowCityButton citySlug={city.slug} initialAuthenticated initialFollowing />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-black/55">Още не следваш градове.</p>
              <Link href="/festivals" className="mt-3 inline-flex rounded-full border border-black/[0.12] bg-white px-4 py-2 text-sm font-semibold text-[#0c0e14] hover:bg-[#f7f6f3]">
                Разгледай по градове
              </Link>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <header className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4">
            <h2 className="text-base font-semibold tracking-tight">⭐ Организатори</h2>
            <span className="text-xs font-medium text-black/45">{organizers.length}</span>
          </header>
          {organizers.length ? (
            <ul className="divide-y divide-black/[0.05]">
              {organizers.map((organizer) => (
                <li key={organizer.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  {organizer.slug ? (
                    <Link href={`/organizers/${encodeURIComponent(organizer.slug)}`} className="min-w-0 truncate text-sm font-medium text-[#0c0e14] hover:underline">
                      {organizer.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-sm font-medium text-[#0c0e14]">{organizer.name}</span>
                  )}
                  <FollowOrganizerButton organizerId={organizer.id} initialAuthenticated initialFollowing />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-black/55">Още не следваш организатори.</p>
              <Link href="/festivals" className="mt-3 inline-flex rounded-full border border-black/[0.12] bg-white px-4 py-2 text-sm font-semibold text-[#0c0e14] hover:bg-[#f7f6f3]">
                Открий организатори
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
