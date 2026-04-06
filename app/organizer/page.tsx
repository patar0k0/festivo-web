import Link from "next/link";
import {
  fetchOrganizerPortalMembershipSummary,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Matches profile/new — emerald onboarding path */
const ctaEmerald =
  "inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white/95 px-5 py-2.5 text-sm font-semibold text-[#0c3d2e] shadow-sm ring-1 ring-emerald-100/40 transition hover:from-emerald-100/40 hover:to-emerald-50/80";

/** Matches claim — amber onboarding path */
const ctaAmber =
  "inline-flex items-center justify-center rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-white/90 px-5 py-2.5 text-sm font-semibold text-[#7c2d12] shadow-sm ring-1 ring-amber-100/50 transition hover:from-amber-100/50 hover:to-amber-50/80";

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
    <div className={cn(pub.page, "min-h-screen px-4 py-8 md:px-6 md:py-12")}>
      <div className={cn(pub.containerNarrow, "space-y-6")}>
        <div className="rounded-2xl border border-emerald-200/45 bg-gradient-to-br from-emerald-50/50 via-white/95 to-amber-50/40 p-6 shadow-sm ring-1 ring-emerald-100/25 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">За организатори</p>
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
            Организаторски профил в Festivo
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-black/65">
            Създайте или заявете публичен профил на организатор, подавайте нови фестивали за преглед и следете статуса им. Публикуването остава след
            модерация от екипа на Festivo.
          </p>
          <ul className="mt-6 space-y-1.5 text-sm leading-snug text-black/75">
            <li className="flex gap-2">
              <span className="text-black/40" aria-hidden>
                •
              </span>
              <span>Профилът на организатор е отделен от личния ви акаунт.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-black/40" aria-hidden>
                •
              </span>
              <span>Подаванията влизат в опашката за одобрение — без директно публикуване.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-black/40" aria-hidden>
                •
              </span>
              <span>Заявки за вече съществуващ профил се одобряват от администратор.</span>
            </li>
          </ul>

          {loggedIn && hasPendingOnly ? (
            <p className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950/90">
              Имате изчакваща заявка за членство. След одобрение от екипа на Festivo ще получите достъп до таблото за организатори.
            </p>
          ) : null}

          {loggedIn && hasRevokedOnly ? (
            <p className="mt-6 rounded-xl border border-amber-200/55 bg-amber-50/80 px-4 py-3 text-sm text-[#5c200d]/95">
              Членството ви като организатор е прекратено. За достъп отново се свържете с екипа на Festivo или подайте нова заявка за профил, ако е приложимо.
            </p>
          ) : null}

          {loggedInNoData ? (
            <p className="mt-6 rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm text-black/60">
              Не успяхме да заредим състоянието на членството. Опитайте отново по-късно.
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {!loggedIn ? (
              <>
                <Link href="/login?next=/organizer" className={cn(pub.btnPrimary, pub.focusRing)}>
                  Вход
                </Link>
                <Link href="/signup?next=/organizer" className={cn(pub.btnSecondary, pub.focusRing)}>
                  Регистрация
                </Link>
              </>
            ) : hasActive ? (
              <>
                <Link href="/organizer/dashboard" className={cn(pub.btnPrimary, pub.focusRing)}>
                  Към таблото
                </Link>
                <Link href="/organizer/profile/new" className={ctaEmerald}>
                  Нов организаторски профил
                </Link>
                <Link href="/organizer/claim" className={ctaAmber}>
                  Заявка за съществуващ профил
                </Link>
              </>
            ) : (
              <>
                <Link href="/organizer/profile/new" className={ctaEmerald}>
                  Нов организаторски профил
                </Link>
                <Link href="/organizer/claim" className={ctaAmber}>
                  Заявка за съществуващ профил
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
