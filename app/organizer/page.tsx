import Link from "next/link";
import { getPortalSessionUser } from "@/lib/organizer/portal";
import "../landing.css";

export const dynamic = "force-dynamic";

export default async function OrganizerEntryPage() {
  const session = await getPortalSessionUser();
  const loggedIn = Boolean(session?.user?.id);

  return (
    <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14] md:px-6 md:py-14">
      <div className="mx-auto max-w-2xl rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-[0_24px_48px_rgba(12,14,20,0.08)] md:p-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/40">За организатори</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">Организаторски профил в Festivo</h1>
        <p className="mt-4 text-sm leading-relaxed text-black/65">
          Създайте или заявете публичен профил на организатор, подавайте нови фестивали за преглед и следете статуса им. Публикуването остава след
          модерация от екипа на Festivo.
        </p>
        <ul className="mt-6 list-inside list-disc space-y-2 text-sm text-black/70">
          <li>Профилът на организатор е отделен от личния ви акаунт.</li>
          <li>Подаванията влизат в опашката за одобрение — без директно публикуване.</li>
          <li>Заявки за вече съществуващ профил се одобряват от администратор.</li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          {loggedIn ? (
            <>
              <Link
                href="/organizer/dashboard"
                className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                Към таблото
              </Link>
              <Link
                href="/organizer/profile/new"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-neutral-50"
              >
                Нов организаторски профил
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login?next=/organizer/dashboard"
                className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                Вход
              </Link>
              <Link
                href="/signup"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-neutral-50"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
