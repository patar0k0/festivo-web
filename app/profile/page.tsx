import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getOptionalUser } from "@/lib/authUser";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";
import ReminderPreferencesCard from "./ReminderPreferencesCard";
import ProfileAvatar from "./ProfileAvatar";
import DeleteAccountButton from "./DeleteAccountButton";
import ProfileGreeting from "./ProfileGreeting";
import QuickLinks from "./QuickLinks";
import MobileAppPromo from "./MobileAppPromo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initialsFromEmail(email: string | null): string {
  if (!email) return "U";
  const local = email.split("@")[0] ?? "";
  const chars = local.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return chars || "U";
}

function initialsFromName(name: string | null): string | null {
  if (!name) return null;
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  const combined = `${a}${b}`.toUpperCase();
  return combined.length > 0 ? combined : null;
}

export default async function ProfilePage() {
  noStore();
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.06] bg-white/90 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Профил</h1>
          <p className="mt-2 text-sm text-black/55">Влез, за да управляваш акаунта си.</p>
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

  // Fetch profile summary (counts + organizer flag). Resilient: returns zeros on error.
  const summary = await getProfileSummary(user.id);

  // Mobile app promo is suppressed for organizers (they use the web portal).
  const showMobilePromo = !summary.isActiveOrganizer;

  const initials =
    initialsFromName(user.displayName) ?? initialsFromEmail(user.email);

  return (
    <div className="min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm">
          <header className="px-5 py-6 md:px-8 md:py-7">
            <ProfileGreeting
              displayName={user.displayName}
              email={user.email}
              createdAt={user.createdAt}
            />
          </header>

          <div className="space-y-8 px-5 pb-8 md:px-8">
            <section>
              <h2 className="text-lg font-semibold tracking-tight text-[#0c0e14]">Информация</h2>
              <div className="mt-4">
                <ProfileAvatar
                  email={user.email}
                  initials={initials}
                  initialAvatarUrl={user.avatarUrl}
                />
              </div>
            </section>

            <QuickLinks
              planCount={summary.planCount}
              followedCitiesCount={summary.followedCitiesCount}
              followedOrganizersCount={summary.followedOrganizersCount}
            />

            {showMobilePromo ? <MobileAppPromo defaultEmail={user.email} /> : null}

            <ReminderPreferencesCard />

            <section className="border-t border-black/[0.05] pt-8 text-sm text-black/55">
              <h2 className="text-sm font-semibold text-black/65">Сигурност</h2>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href="/reset-password"
                  className="inline-flex items-center justify-center rounded-lg border border-black/[0.12] bg-white px-3.5 py-2 text-sm font-medium text-[#0c0e14] transition hover:bg-neutral-50"
                >
                  Смени парола
                </Link>
                <form action="/api/auth/logout" method="post" className="inline">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg border border-black/[0.1] bg-white px-3.5 py-2 text-sm font-medium text-black/70 transition hover:bg-neutral-50"
                  >
                    Изход
                  </button>
                </form>
              </div>
              <DeleteAccountButton />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
