import Link from "next/link";
import BuildStamp from "@/app/_components/BuildStamp";

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

/**
 * Shared internal workspace chrome: top system bar, left sidebar slot, main content.
 * Page background is `body.landing-bg`; shell uses white/blur panels on top.
 */
export default function WorkspaceShell({
  density,
  eyebrow,
  email,
  children,
  sidebar,
}: {
  density: WorkspaceDensity;
  eyebrow: string;
  email: string | null;
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col text-[#0c0e14]">
      <header
        className={`border-b border-black/[0.08] bg-white/85 backdrop-blur ${densityTop[density]}`}
      >
        <div className="mx-auto flex w-full max-w-[1800px] min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45">{eyebrow}</p>
            <p className="text-sm text-black/60">{email ?? "—"}</p>
            <BuildStamp compact />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="shrink-0 rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-black/70 transition hover:bg-[#f7f6f3]"
            >
              Към сайта
            </Link>
            <form action="/api/auth/logout" method="post" className="shrink-0">
              <button
                type="submit"
                className="rounded-xl bg-[#0c0e14] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#1d202b]"
              >
                Изход
              </button>
            </form>
          </div>
        </div>
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
