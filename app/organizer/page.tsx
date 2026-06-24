import Link from "next/link";
import { redirect } from "next/navigation";
import {
  fetchOrganizerPortalMembershipSummaryCached,
  getPortalAdminClient,
  getPortalSessionUser,
} from "@/lib/organizer/portal";
import { attemptOrganizerAutoClaimByEmail } from "@/lib/organizer/autoClaimOrganizersByEmail";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// State-specific CTA palettes — chosen so the two paths feel visually distinct.
// Emerald = green-light onboarding (you're starting fresh). Amber = warm,
// requires admin approval (claiming an existing organizer).
const ctaEmerald =
  "inline-flex items-center justify-center rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white/95 px-5 py-3 text-sm font-semibold text-[#0c3d2e] shadow-sm ring-1 ring-emerald-100/40 transition-all duration-150 hover:from-emerald-100/40 hover:to-emerald-50/80 hover:-translate-y-px";

const ctaAmber =
  "inline-flex items-center justify-center rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-white/90 px-5 py-3 text-sm font-semibold text-[#7c2d12] shadow-sm ring-1 ring-amber-100/50 transition-all duration-150 hover:from-amber-100/50 hover:to-amber-50/80 hover:-translate-y-px";

const BENEFITS = [
  {
    icon: "🎯",
    title: "Достигни точната аудитория",
    body: "Хората които посещават Festivo вече търсят фестивали. Не плащаш за внимание — то идва от само себе си.",
  },
  {
    icon: "✨",
    title: "Професионален профил",
    body: "Лого, описание, контакти, медия и история на фестивалите ти — на едно място, готово за споделяне.",
  },
  {
    icon: "🔔",
    title: "Известия преди събитие",
    body: "Хората запазват фестивала ти и получават автоматично напомняне 1 ден преди и 2 часа преди старт.",
  },
  {
    icon: "📊",
    title: "Прозрачна модерация",
    body: "Подаванията влизат в опашка за преглед. Получаваш ясен статус и обратна връзка по имейл.",
  },
  {
    icon: "🚀",
    title: "Промотиране при нужда",
    body: "При важно събитие — boost-ваш видимостта си с промоцирани листинги. Без дългосрочни договори.",
  },
  {
    icon: "🇧🇬",
    title: "Локално и безплатно",
    body: "Базовата регистрация и публикуване са безплатни. Без скрити такси, без обвързване.",
  },
] as const;

const STEPS = [
  {
    n: 1,
    title: "Заяви или създай профил",
    body: "Ако организираш фестивал който вече е в Festivo — пращаш заявка за достъп. Ако започваш от нула — създаваш нов профил.",
  },
  {
    n: 2,
    title: "Получаваш одобрение",
    body: "Екипът проверява заявката (обикновено 1–3 работни дни) и потвърждава достъпа ти по имейл.",
  },
  {
    n: 3,
    title: "Публикувай фестивалите си",
    body: "Добавяш събития с програма, локация, снимки. Всеки фестивал минава кратък преглед преди да стане публичен.",
  },
  {
    n: 4,
    title: "Следиш интереса",
    body: "Виждаш статуса на всяко подаване, получаваш имейл при одобрение, и хората вече намират фестивала ти.",
  },
] as const;

const FAQ = [
  {
    q: "Колко струва?",
    a: "Базовата регистрация и публикуването на фестивали са безплатни. Платените услуги (VIP план, промотиране на конкретен фестивал) са доброволни — описани в страницата за условия.",
  },
  {
    q: "Колко време отнема одобрението?",
    a: "Заявка за достъп до организаторски профил: обикновено 1–3 работни дни. Подаване на нов фестивал: 24–48 часа в работни дни.",
  },
  {
    q: "Кой вижда фестивалите ми?",
    a: "Всеки посетител на festivo.bg може да открие верифицираните фестивали. Локалните потребители получават и push известия на мобилното приложение.",
  },
  {
    q: "Мога ли да премахна профила си?",
    a: "Да, по всяко време. Пиши на admin@festivo.bg — премахваме профила и съдържанието според условията за организатори.",
  },
] as const;

export default async function OrganizerEntryPage() {
  const session = await getPortalSessionUser();
  const loggedIn = Boolean(session?.user?.id);

  let summary: Awaited<ReturnType<typeof fetchOrganizerPortalMembershipSummaryCached>> | null = null;
  if (loggedIn && session?.user?.id) {
    try {
      summary = await fetchOrganizerPortalMembershipSummaryCached(session.user.id);
    } catch {
      summary = null;
    }
  }

  // Active organizer owners go straight to their dashboard — they don't need this landing.
  if (loggedIn && summary?.isOrganizerOwner) {
    redirect("/organizer/dashboard");
  }

  // Not an owner yet — check whether the confirmed account email exactly matches one
  // unclaimed organizer profile, and auto-grant ownership if so. `redirect()` throws
  // internally, so it must run outside the try/catch below (a caught NEXT_REDIRECT
  // would silently swallow the navigation).
  // See docs/superpowers/specs/2026-06-23-organizer-auto-claim-by-email-design.md
  let autoClaimGranted = false;
  if (loggedIn && session?.user?.id && session.user.email) {
    try {
      const adminClient = getPortalAdminClient();
      const result = await attemptOrganizerAutoClaimByEmail(adminClient, session.user.id, session.user.email);
      autoClaimGranted = result.claimed;
    } catch (err) {
      console.error("[organizer_auto_claim] unexpected error on /organizer landing", err);
    }
  }
  if (autoClaimGranted) {
    redirect("/organizer/dashboard");
  }

  const hasActive = (summary?.activeOrganizerIds.length ?? 0) > 0;
  const hasPendingOnly = Boolean(summary?.hasPendingMembership) && !hasActive;
  const hasRevokedOnly =
    Boolean(summary?.hasRevokedMembership) && !hasActive && !Boolean(summary?.hasPendingMembership);
  const loggedInNoData = loggedIn && summary === null;

  return (
    <div className={cn(pub.page, "min-h-screen")}>
      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="px-4 pt-10 pb-12 md:px-6 md:pt-16 md:pb-16">
        <div className={cn(pub.container, "max-w-4xl")}>
          <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50/70 via-white to-emerald-50/40 p-6 shadow-sm ring-1 ring-amber-100/40 md:p-10">
            {/* Decorative orange blob */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#7c2d12]/10 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl"
            />

            <div className="relative">
              <p className={pub.eyebrowMuted}>За организатори</p>
              <h1
                className={cn(
                  "mt-4 font-[var(--font-display)] font-bold tracking-tight text-[#0c0e14]",
                  "text-3xl leading-[1.1] md:text-5xl",
                )}
              >
                Публикувай фестивала си
                <br />
                <span className="text-[#7c2d12]">пред хората, които го търсят.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/70 md:text-lg">
                Festivo е каталогът на фестивалите в България. Безплатна регистрация,
                професионален публичен профил и модерация която пази качеството на
                съдържанието.
              </p>

              {/* Status messages (preserved from original) */}
              {loggedIn && hasPendingOnly ? (
                <div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950/90">
                  <strong>Имате изчакваща заявка.</strong> След одобрение от екипа на
                  Festivo ще получите имейл с достъп до таблото за организатори.
                </div>
              ) : null}

              {loggedIn && hasRevokedOnly ? (
                <div className="mt-6 rounded-xl border border-amber-200/55 bg-amber-50/80 px-4 py-3 text-sm text-[#5c200d]/95">
                  Членството ви като организатор е прекратено. За достъп отново се
                  свържете с екипа на Festivo или подайте нова заявка за профил.
                </div>
              ) : null}

              {loggedInNoData ? (
                <div className="mt-6 rounded-xl border border-black/[0.08] bg-white px-4 py-3 text-sm text-black/60">
                  Не успяхме да заредим състоянието на членството. Опитайте отново
                  по-късно.
                </div>
              ) : null}

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {!loggedIn ? (
                  <>
                    <Link
                      href="/login?next=/organizer"
                      className={cn(pub.btnPrimary, pub.focusRing, "py-3")}
                    >
                      Вход
                    </Link>
                    <Link
                      href="/signup?next=/organizer"
                      className={cn(pub.btnSecondary, pub.focusRing, "py-3")}
                    >
                      Регистрация
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/organizer/profile/new"
                      className={cn(ctaEmerald, pub.focusRing)}
                    >
                      ✨ Нов организаторски профил
                    </Link>
                    <Link
                      href="/organizer/claim"
                      className={cn(ctaAmber, pub.focusRing)}
                    >
                      📋 Заявка за съществуващ
                    </Link>
                  </>
                )}
              </div>

              <p className="mt-4 text-xs text-black/50">
                Базовата регистрация е{" "}
                <strong className="font-semibold text-[#0c0e14]">безплатна</strong>. Без
                задължения, без обвързване.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ─────────────────────────────────────────────────── */}
      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className={cn(pub.container, "max-w-5xl")}>
          <div className="text-center">
            <p className={pub.eyebrowMuted}>Защо Festivo</p>
            <h2 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              Всичко необходимо да бъдеш видим
            </h2>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <article
                key={b.title}
                className="rounded-2xl border border-amber-200/35 bg-white/95 p-5 shadow-[0_2px_0_rgba(12,14,20,0.04),0_6px_18px_rgba(12,14,20,0.05)] ring-1 ring-amber-100/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fef3e2] text-2xl">
                  <span aria-hidden="true">{b.icon}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#0c0e14]">{b.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/65">{b.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className={cn(pub.container, "max-w-4xl")}>
          <div className="text-center">
            <p className={pub.eyebrowMuted}>Как работи</p>
            <h2 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              4 стъпки до публичен профил
            </h2>
          </div>

          <ol className="mt-10 space-y-4">
            {STEPS.map((s, i) => (
              <li
                key={s.n}
                className="relative flex gap-5 rounded-2xl border border-black/[0.06] bg-white/95 p-5 shadow-sm md:gap-6 md:p-6"
              >
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7c2d12] text-sm font-bold text-white">
                    {s.n}
                  </div>
                  {i < STEPS.length - 1 ? (
                    <div
                      aria-hidden="true"
                      className="mt-2 h-full w-px flex-1 bg-gradient-to-b from-[#7c2d12]/40 to-transparent"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <h3 className="text-base font-semibold text-[#0c0e14] md:text-lg">
                    {s.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-black/65">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className={cn(pub.container, "max-w-3xl")}>
          <div className="rounded-3xl border border-amber-200/65 bg-gradient-to-br from-amber-50/80 via-white to-emerald-50/40 p-6 text-center shadow-sm ring-1 ring-amber-100/40 md:p-10">
            <p className={pub.eyebrowMuted}>Готов?</p>
            <h2 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              Започни за по-малко от 5 минути
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-black/65 md:text-base">
              Безплатна регистрация. Без кредитна карта. Достъпът до таблото идва след
              одобрение от модератор.
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
              {!loggedIn ? (
                <>
                  <Link
                    href="/signup?next=/organizer"
                    className={cn(pub.btnPrimary, pub.focusRing, "py-3 sm:min-w-[200px]")}
                  >
                    Регистрация
                  </Link>
                  <Link
                    href="/login?next=/organizer"
                    className={cn(pub.btnSecondary, pub.focusRing, "py-3 sm:min-w-[200px]")}
                  >
                    Вход
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/organizer/profile/new"
                    className={cn(ctaEmerald, pub.focusRing)}
                  >
                    ✨ Нов организаторски профил
                  </Link>
                  <Link href="/organizer/claim" className={cn(ctaAmber, pub.focusRing)}>
                    📋 Заявка за съществуващ
                  </Link>
                </>
              )}
            </div>

            <p className="mt-5 text-xs text-black/55">
              С регистрация приемаш{" "}
              <Link
                href="/terms-organizers"
                className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
              >
                Условията за организатори
              </Link>{" "}
              и{" "}
              <Link
                href="/privacy"
                className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
              >
                Политиката за поверителност
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="px-4 py-10 md:px-6 md:py-14">
        <div className={cn(pub.container, "max-w-3xl")}>
          <div className="text-center">
            <p className={pub.eyebrowMuted}>Често задавани въпроси</p>
            <h2 className="mt-3 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              Какво е добре да знаеш
            </h2>
          </div>

          <dl className="mt-10 space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-black/[0.06] bg-white/95 p-5 shadow-sm transition-all duration-200 hover:border-black/[0.12] open:border-amber-200/60 md:p-6"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-[#0c0e14] md:text-base">
                  <span>{item.q}</span>
                  <span
                    aria-hidden="true"
                    className="text-lg text-black/40 transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-black/65">{item.a}</p>
              </details>
            ))}
          </dl>

          <p className="mt-8 text-center text-sm text-black/55">
            Не намираш отговор?{" "}
            <a
              href="mailto:admin@festivo.bg"
              className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
            >
              admin@festivo.bg
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
