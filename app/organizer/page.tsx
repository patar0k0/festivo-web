import Link from "next/link";
import {
  fetchOrganizerPortalMembershipSummary,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import "@/app/landing.css";

export const dynamic = "force-dynamic";

export default async function OrganizerEntryPage() {
  const session = await getPortalSessionUser();
  const loggedIn = Boolean(session?.user?.id);

  let summary: Awaited<ReturnType<typeof fetchOrganizerPortalMembershipSummary>> | null = null;
  if (loggedIn && session?.user?.id) {
    try {
      const admin = getPortalAdminClient();
      summary = await fetchOrganizerPortalMembershipSummary(admin, session.user.id);
    } catch {
      summary = null;
    }
  }

  const hasActive = (summary?.activeOrganizerIds.length ?? 0) > 0;
  const hasPendingOnly = Boolean(summary?.hasPendingMembership) && !hasActive;
  const hasRevokedOnly =
    Boolean(summary?.hasRevokedMembership) && !hasActive && !Boolean(summary?.hasPendingMembership);
  const loggedInNoData = loggedIn && summary === null;

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

        {loggedIn && hasPendingOnly ? (
          <p className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950/90">
            Имате изчакваща заявка за членство. След одобрение от екипа на Festivo ще получите достъп до таблото за организатори.
          </p>
        ) : null}

        {loggedIn && hasRevokedOnly ? (
          <p className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50/90 px-4 py-3 text-sm text-neutral-800">
            Членството ви като организатор е прекратено. За достъп отново се свържете с екипа на Festivo или подайте нова заявка за профил, ако е приложимо.
          </p>
        ) : null}

        {loggedInNoData ? (
          <p className="mt-6 rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm text-black/60">
            Не успяхме да заредим състоянието на членството. Опитайте отново по-късно.
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-3">
          {!loggedIn ? (
            <>
              <Link
                href="/login?next=/organizer"
                className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                Вход
              </Link>
              <Link
                href="/signup?next=/organizer"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-neutral-50"
              >
                Регистрация
              </Link>
            </>
          ) : hasActive ? (
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
              <Link
                href="/organizer/claim"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-neutral-50"
              >
                Заявка за съществуващ профил
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/organizer/profile/new"
                className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                Нов организаторски профил
              </Link>
              <Link
                href="/organizer/claim"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-neutral-50"
              >
                Заявка за съществуващ профил
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
