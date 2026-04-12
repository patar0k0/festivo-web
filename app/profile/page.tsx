import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getOptionalUser } from "@/lib/authUser";
import NotificationSettingsCard from "./NotificationSettingsCard";
import ReminderPreferencesCard from "./ReminderPreferencesCard";
import ProfileAvatar from "./ProfileAvatar";
import DeleteAccountButton from "./DeleteAccountButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initialsFromEmail(email: string | null): string {
  if (!email) return "U";
  const local = email.split("@")[0] ?? "";
  const chars = local.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return chars || "U";
}

export default async function ProfilePage() {
  noStore();
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h1 className="text-3xl font-black tracking-tight">Профил</h1>
          <p className="mt-3 text-sm text-black/65">Влез, за да видиш и управляваш акаунта си.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white"
            >
              Вход
            </Link>
            <Link
              href="/signup"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c0e14]"
            >
              Регистрация
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-12">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_0_rgba(12,14,20,0.04),0_24px_48px_rgba(12,14,20,0.08)]">
          <header className="border-b border-black/[0.06] bg-gradient-to-br from-white via-white to-neutral-50 px-5 py-7 md:px-8 md:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">Акаунт</p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">Профил</h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-black/60">
              Имейл, сигурност, напомняния за плана и останалите push известия на едно място.
            </p>
          </header>

          <div className="divide-y divide-black/[0.06] px-5 py-2 md:px-8">
            <section className="py-6 md:py-7">
              <h2 className="text-base font-semibold text-[#0c0e14]">Данни за вход</h2>
              <p className="mt-1 text-sm text-black/55">Вход през Supabase Auth (имейл/парола или социални мрежи).</p>
              <div className="mt-5">
                <ProfileAvatar
                  email={user.email}
                  initials={initialsFromEmail(user.email)}
                  initialAvatarUrl={user.avatarUrl}
                />
              </div>
            </section>

            <section className="py-6 md:py-7">
              <h2 className="text-base font-semibold text-[#0c0e14]">Сигурност</h2>
              <p className="mt-1 text-sm text-black/55">Парола и изход от устройството.</p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Link
                  href="/reset-password"
                  className="inline-flex items-center justify-center rounded-lg bg-[#0c0e14] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
                >
                  Смени парола
                </Link>
                <form action="/api/auth/logout" method="post" className="inline">
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-800 transition hover:border-red-300 hover:bg-red-50"
                  >
                    Изход
                  </button>
                </form>
              </div>
              <DeleteAccountButton />
            </section>

            <ReminderPreferencesCard />
            <NotificationSettingsCard />
          </div>
        </div>
      </div>
    </div>
  );
}
