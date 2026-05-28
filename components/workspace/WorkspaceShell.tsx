import Image from "next/image";
import Link from "next/link";

export type WorkspaceDensity = "admin-c" | "organizer-b";

const densityMain: Record<WorkspaceDensity, string> = {
  "admin-c": "px-4 py-4 md:px-5 md:py-5",
  "organizer-b": "px-5 py-7 md:px-8 md:py-9",
};

const densityTop: Record<WorkspaceDensity, string> = {
  "admin-c": "px-4 py-2.5 md:px-5",
  "organizer-b": "px-5 py-3.5 md:px-8",
};

const densityAside: Record<WorkspaceDensity, string> = {
  "admin-c": "p-3 md:w-[13.5rem] md:shrink-0 md:p-4",
  "organizer-b": "p-4 md:w-[15rem] md:shrink-0 md:p-5 lg:w-[17rem]",
};

/** Strip leading "Festivo · " or "Festivo " so the topbar can render
 * [Festivo logo] · {section} without duplicating the brand. */
function deriveSectionLabel(eyebrow: string): string {
  return eyebrow
    .replace(/^festivo\s*·\s*/i, "")
    .replace(/^festivo\s+/i, "")
    .trim();
}

/** First alphanumeric char from email local-part, uppercase. */
function avatarInitial(email: string | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? "";
  const match = local.match(/[a-zа-я0-9]/i);
  return (match?.[0] ?? "?").toUpperCase();
}

/**
 * Shared internal workspace chrome: top system bar, left sidebar slot, main content.
 * Page background is `body.landing-bg`; shell uses white/blur panels on top.
 */
export default function WorkspaceShell({
  density,
  eyebrow,
  email,
  headerSummary,
  children,
  sidebar,
}: {
  density: WorkspaceDensity;
  eyebrow: string;
  email: string | null;
  /** Optional row under the email (e.g. organizer monetization summary). */
  headerSummary?: React.ReactNode;
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  const sectionLabel = deriveSectionLabel(eyebrow);
  const initial = avatarInitial(email);

  return (
    <div className="flex min-h-screen flex-col text-[#0c0e14]">
      <header
        className={`sticky top-0 z-30 border-b border-black/[0.08] bg-white/85 backdrop-blur ${densityTop[density]}`}
      >
        <div className="mx-auto flex w-full max-w-[1800px] min-w-0 flex-wrap items-center justify-between gap-3">
          {/* ── Left: Logo + breadcrumb ─ */}
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="group inline-flex shrink-0 items-center gap-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
              aria-label="Festivo — към публичния сайт"
            >
              <Image
                src="/brand/festivo-icon.svg"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7"
                priority
              />
              <span className="hidden text-sm font-bold tracking-tight text-[#0c0e14] sm:inline">
                Festivo
              </span>
            </Link>
            <span
              aria-hidden="true"
              className="hidden text-black/25 sm:inline"
            >
              /
            </span>
            <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-black/55 sm:text-sm sm:tracking-[0.1em] sm:normal-case sm:font-medium">
              {sectionLabel || "Workspace"}
            </p>
          </div>

          {/* ── Right: User + actions ─ */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Avatar + email */}
            <div className="hidden items-center gap-2 rounded-xl bg-white/50 px-2.5 py-1.5 ring-1 ring-black/[0.06] sm:inline-flex">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#7c2d12] to-[#5c200d] text-[11px] font-bold text-white"
                aria-hidden="true"
              >
                {initial}
              </span>
              <span className="hidden max-w-[200px] truncate text-xs text-black/70 md:inline">
                {email ?? "—"}
              </span>
            </div>

            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold text-black/70 transition-all duration-150 hover:bg-[#f7f6f3] hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
            >
              <span aria-hidden="true">←</span> Към сайта
            </Link>
            <form action="/api/auth/logout" method="post" className="shrink-0">
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-xs font-semibold text-black/70 transition-all duration-150 hover:bg-black/[0.04] hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
                aria-label="Изход от акаунта"
              >
                Изход
              </button>
            </form>
          </div>
        </div>

        {headerSummary ? (
          <div className="mx-auto mt-3 w-full max-w-[1800px]">{headerSummary}</div>
        ) : null}
      </header>

      <div className="mx-auto flex w-full max-w-[1800px] min-h-0 flex-1 flex-col md:flex-row">
        <aside
          className={`w-full border-black/[0.08] bg-white/65 backdrop-blur md:border-r ${densityAside[density]}`}
        >
          {sidebar}
        </aside>
        <main className={`min-w-0 flex-1 overflow-x-auto ${densityMain[density]}`}>{children}</main>
      </div>
    </div>
  );
}
