import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { bg } from "date-fns/locale";
import { requireOrganizerOwnerPortalSession } from "@/lib/organizer/portal";
import { getOptionalUser } from "@/lib/authUser";
import {
  computeOrganizerCompleteness,
  type OrganizerCompletenessResult,
} from "@/lib/organizer/profileCompleteness";

export const dynamic = "force-dynamic";

type SubmissionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  organizer_id: string | null;
};

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
};

type FestivalOrgIdRow = {
  organizer_id: string | null;
};

function statusMeta(status: string): {
  label: string;
  className: string;
  dotClassName: string;
} {
  switch (status) {
    case "pending":
      return {
        label: "Чака преглед",
        className: "border-amber-200/80 bg-amber-50/90 text-amber-900",
        dotClassName: "bg-amber-500",
      };
    case "approved":
      return {
        label: "Одобрено",
        className: "border-emerald-200/80 bg-emerald-50/90 text-emerald-900",
        dotClassName: "bg-emerald-500",
      };
    case "rejected":
      return {
        label: "Отхвърлено",
        className: "border-red-200/80 bg-red-50/90 text-red-900",
        dotClassName: "bg-red-500",
      };
    case "draft":
      return {
        label: "Чернова",
        className: "border-black/10 bg-[#f5f4f0] text-black/55",
        dotClassName: "bg-black/25",
      };
    default:
      return {
        label: status,
        className: "border-black/10 bg-white text-black/65",
        dotClassName: "bg-black/30",
      };
  }
}

/** First token of a person's display name (e.g. "Иван Петров" → "Иван"). */
function firstNameFrom(name: string | null | undefined): string | null {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : null;
}

/** Humanish first name derived from an email local-part (e.g. "ivan.petrov" → "Ivan"). */
function firstNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^\p{L}\p{N}]/gu, " ").trim();
  const first = cleaned.split(/\s+/)[0];
  if (!first || first.length < 2) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = parts[0]?.charAt(0) ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return `${a}${b}`.toUpperCase() || "?";
}

export default async function OrganizerDashboardPage() {
  const gate = await requireOrganizerOwnerPortalSession("/organizer/dashboard");
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

  const { admin, orgIds } = gate;

  // Fetch the session user (for the greeting), organizations (with profile fields), submissions,
  // and published-festival counts in parallel.
  const [sessionUser, orgsRes, submissionsRes, festivalsRes] = await Promise.all([
    getOptionalUser(),
    orgIds.length > 0
      ? admin
          .from("organizers")
          .select("id,name,slug,logo_url,description,website_url,facebook_url,instagram_url,email,phone")
          .in("id", orgIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as OrgRow[] }),
    orgIds.length > 0
      ? admin
          .from("pending_festivals")
          .select("id,title,status,created_at,organizer_id,submission_source")
          .in("organizer_id", orgIds)
          .eq("submission_source", "organizer_portal")
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as SubmissionRow[] }),
    orgIds.length > 0
      ? admin
          .from("festivals")
          .select("organizer_id")
          .in("organizer_id", orgIds)
          .in("status", ["verified", "published"])
      : Promise.resolve({ data: [] as FestivalOrgIdRow[] }),
  ]);

  const orgRows = (orgsRes.data ?? []) as OrgRow[];
  const submissions = (submissionsRes.data ?? []) as SubmissionRow[];

  const festivalCountByOrg = new Map<string, number>();
  for (const row of (festivalsRes.data ?? []) as FestivalOrgIdRow[]) {
    if (!row.organizer_id) continue;
    festivalCountByOrg.set(row.organizer_id, (festivalCountByOrg.get(row.organizer_id) ?? 0) + 1);
  }

  const hasOrgs = orgRows.length > 0;
  const hasSubmissions = submissions.length > 0;

  const submissionCount = submissions.length;
  const pendingCount = submissions.filter((s) => s.status === "pending").length;
  const approvedCount = submissions.filter((s) => s.status === "approved").length;

  // Onboarding "edit profile" CTA. With a single profile, link straight to its edit page.
  // With several, the link is ambiguous — point to the "Моите организации" section, where
  // each profile has its own edit button. With none, offer to create one.
  const profileEditCta =
    orgRows.length === 1 && orgRows[0]?.id
      ? { label: "Редактирай профила", href: `/organizer/organizations/${orgRows[0].id}/edit` }
      : orgRows.length > 1
        ? { label: "Виж профилите", href: "#organizations" }
        : { label: "Създай профил", href: "/organizer/profile/new" };

  // Greet the user (the dashboard belongs to the person, not a single organization —
  // a user may own several organizer profiles). Falls back to email, then a neutral greeting.
  const greetingName =
    firstNameFrom(sessionUser?.displayName) ?? firstNameFromEmail(sessionUser?.email) ?? "";
  const greeting = greetingName ? `Добре дошъл, ${greetingName}!` : "Добре дошъл!";

  return (
    <div className="space-y-7">
      {/* ── Welcome header ────────────────────────────────────────── */}
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">
          Табло
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
          {greeting}
        </h1>
        <p className="mt-2 text-sm text-black/60">
          Управление на профили и подавания за модерация.
        </p>
      </header>

      {/* ── Stats overview ────────────────────────────────────────── */}
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Обобщение"
      >
        <StatCard
          icon="🏢"
          label="Активни профили"
          value={orgRows.length}
          tone="emerald"
        />
        <StatCard
          icon="📋"
          label="Подавания общо"
          value={submissionCount}
          tone="neutral"
        />
        <StatCard
          icon="⏳"
          label="Чакат преглед"
          value={pendingCount}
          tone="amber"
          subtitle={
            pendingCount > 0
              ? `${approvedCount} одобрени`
              : approvedCount > 0
                ? `${approvedCount} одобрени`
                : "Няма в опашката"
          }
        />
      </section>

      {/* ── Onboarding checklist (when no submissions) ────────────── */}
      {!hasSubmissions ? (
        <section className="rounded-2xl border border-amber-200/55 bg-gradient-to-br from-amber-50/60 via-white to-white/95 p-6 shadow-sm ring-1 ring-amber-100/40 md:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c2d12]">
            Започни тук
          </p>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold tracking-tight text-[#0c0e14] md:text-2xl">
            Първи стъпки
          </h2>
          <p className="mt-1 text-sm text-black/60">
            3 кратки стъпки преди първия ти публикуван фестивал.
          </p>

          <ol className="mt-6 space-y-3">
            <ChecklistItem
              n={1}
              title="Профил готов"
              done
              body="Имаш активен организаторски профил във Festivo."
              cta={profileEditCta}
            />
            <ChecklistItem
              n={2}
              title="Добави първи фестивал"
              done={false}
              body="Попълни заглавие, дати, локация и кратко описание — формата ще те води стъпка по стъпка."
              cta={{
                label: "Започни сега",
                href: "/organizer/festivals/new",
                primary: true,
              }}
            />
            <ChecklistItem
              n={3}
              title="Промотиране (по избор)"
              done={false}
              body="След като имаш фестивал, можеш да го промотираш за повече видимост."
              cta={{
                label: "Виж опциите",
                href: "/organizer/benefits",
              }}
            />
          </ol>
        </section>
      ) : null}

      {/* ── My organizations ──────────────────────────────────────── */}
      <section
        id="organizations"
        className="scroll-mt-24 rounded-2xl border border-black/[0.06] bg-white/95 p-6 shadow-sm md:p-7"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-[#0c0e14]">Моите организации</h2>
          {hasOrgs ? (
            <span className="text-xs text-black/45">
              {orgRows.length} {orgRows.length === 1 ? "профил" : "профила"}
            </span>
          ) : null}
        </div>

        {!hasOrgs ? (
          <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-[#fafaf8] px-5 py-6 text-center">
            <p className="text-sm font-medium text-black/65">Нямаш активни профили</p>
            <p className="mt-1 text-xs text-black/55">
              Започни като{" "}
              <Link
                href="/organizer/profile/new"
                className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
              >
                създадеш нов профил
              </Link>{" "}
              или{" "}
              <Link
                href="/organizer/claim"
                className="font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
              >
                заявиш съществуващ
              </Link>
              .
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {orgRows.map((org) => {
              const completeness = computeOrganizerCompleteness({
                logo_url: org.logo_url ?? "",
                description: org.description ?? "",
                website_url: org.website_url ?? "",
                facebook_url: org.facebook_url ?? "",
                instagram_url: org.instagram_url ?? "",
                email: org.email ?? "",
                phone: org.phone ?? "",
                festivalCount: festivalCountByOrg.get(org.id) ?? 0,
              });
              return (
                <li
                  key={org.id}
                  className="group rounded-xl border border-black/[0.07] bg-white px-4 py-3.5 transition-all duration-150 hover:border-black/[0.15] hover:shadow-sm md:px-5 md:py-4"
                >
                  <div className="flex flex-wrap items-center gap-4">
                    <OrganizerLogo name={org.name} logoUrl={org.logo_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0c0e14] md:text-base">
                        {org.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-black/50">
                        festivo.bg/organizers/{org.slug}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/organizer/organizations/${org.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.04]"
                      >
                        Редактирай
                      </Link>
                      <Link
                        href={`/organizers/${org.slug}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-black/55 transition hover:text-[#0c0e14] hover:underline hover:underline-offset-2"
                      >
                        Публичен профил →
                      </Link>
                    </div>
                  </div>
                  <CompletenessBar completeness={completeness} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Submissions ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-black/[0.06] bg-white/95 p-6 shadow-sm md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0c0e14]">Подавания</h2>
            {hasSubmissions ? (
              <p className="mt-0.5 text-xs text-black/45">
                {submissionCount === 1
                  ? "Показва се последното подаване"
                  : `Показват се последните ${submissionCount} подавания`}
              </p>
            ) : null}
          </div>
          <Link
            href="/organizer/festivals/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c2d12] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] active:scale-[0.99]"
          >
            + Добави фестивал
          </Link>
        </div>

        {!hasSubmissions ? (
          <div className="mt-5 rounded-xl border border-dashed border-black/15 bg-[#fafaf8] px-5 py-8 text-center">
            <p className="text-2xl" aria-hidden="true">
              🎪
            </p>
            <p className="mt-2 text-sm font-medium text-black/65">
              Все още нямаш подадени фестивали
            </p>
            <p className="mt-1 text-xs text-black/55">
              Добави първия си — формата те води стъпка по стъпка.
            </p>
            <Link
              href="/organizer/festivals/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#7c2d12] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-[#5c200d]"
            >
              Започни сега
            </Link>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-black/[0.06]">
            {submissions.map((row) => {
              const meta = statusMeta(row.status);
              const createdDate = new Date(row.created_at);
              const isValidDate = !Number.isNaN(createdDate.getTime());
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0c0e14]">{row.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-black/50">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${meta.dotClassName}`}
                        />
                        {meta.label}
                      </span>
                      {isValidDate ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <time dateTime={row.created_at} title={format(createdDate, "d MMM yyyy", { locale: bg })}>
                            подадено{" "}
                            {formatDistanceToNow(createdDate, { addSuffix: true, locale: bg })}
                          </time>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {(row.status === "pending" || row.status === "draft") ? (
                    <Link
                      href={`/organizer/submissions/${row.id}/edit`}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.04]"
                    >
                      {row.status === "draft" ? "Довърши и изпрати" : "Редактирай"}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-5 text-xs leading-relaxed text-black/45">
          Пълен преглед и одобрение се извършват от екипа на Festivo. Получаваш имейл
          уведомление при промяна на статуса.
        </p>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  tone,
  subtitle,
}: {
  icon: string;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "neutral";
  subtitle?: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200/55 bg-gradient-to-br from-emerald-50/40 to-white/95"
      : tone === "amber"
        ? "border-amber-200/55 bg-gradient-to-br from-amber-50/40 to-white/95"
        : "border-black/[0.06] bg-white/95";

  const iconBg =
    tone === "emerald"
      ? "bg-emerald-100/60 text-emerald-900"
      : tone === "amber"
        ? "bg-amber-100/60 text-amber-900"
        : "bg-black/[0.04] text-black/70";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm md:p-5 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${iconBg}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/55">
          {label}
        </p>
      </div>
      <p className="mt-3 text-3xl font-bold tracking-tight text-[#0c0e14]">{value}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[11px] text-black/50">{subtitle}</p>
      ) : null}
    </div>
  );
}

function ChecklistItem({
  n,
  title,
  body,
  done,
  cta,
}: {
  n: number;
  title: string;
  body: string;
  done: boolean;
  cta: { label: string; href: string; primary?: boolean };
}) {
  return (
    <li className="flex gap-4 rounded-xl border border-black/[0.06] bg-white/90 p-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          done ? "bg-emerald-500 text-white" : "border-2 border-[#7c2d12]/30 bg-white text-[#7c2d12]"
        }`}
        aria-hidden="true"
      >
        {done ? "✓" : n}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0c0e14]">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-black/60">{body}</p>
        <Link
          href={cta.href}
          className={
            cta.primary
              ? "mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#7c2d12] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#5c200d]"
              : "mt-2 inline-block text-xs font-semibold text-[#7c2d12] underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
          }
        >
          {cta.label} {cta.primary ? "→" : null}
        </Link>
      </div>
    </li>
  );
}

function CompletenessBar({ completeness }: { completeness: OrganizerCompletenessResult }) {
  const missing = completeness.items.filter((item) => !item.done).map((item) => item.label);
  const percent = Math.round((completeness.doneCount / completeness.total) * 100);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-black/50">Пълнота на профила</span>
        <span className="text-[11px] font-medium text-black/50">
          {completeness.doneCount}/{completeness.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <p className="mt-1.5 text-[11px] text-black/45">Липсва: {missing.join(", ")}</p>
      ) : null}
    </div>
  );
}

function OrganizerLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Organizer logos come from Supabase storage; whitelisted in next.config.js but kept as <img> to avoid layout shift while we lack explicit dimensions.
      <img
        src={logoUrl}
        alt=""
        className="h-12 w-12 shrink-0 rounded-lg border border-black/[0.08] object-cover"
      />
    );
  }
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c2d12] to-[#5c200d] text-sm font-bold text-white shadow-sm"
      aria-hidden="true"
    >
      {initialsFrom(name)}
    </div>
  );
}
