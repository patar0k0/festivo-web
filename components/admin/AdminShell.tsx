import Link from "next/link";
import AdminTopNav from "@/components/admin/AdminTopNav";

export default function AdminShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <div className="border-b border-black/[0.08] bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3 sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Festivo админ</p>
              <p className="text-sm text-black/60">{email ?? "admin"}</p>
              <form action="/api/auth/logout" method="post" className="mt-1.5">
                <button
                  type="submit"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-black/60 underline-offset-2 hover:text-[#0c0e14] hover:underline"
                >
                  Изход
                </button>
              </form>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-black/70 hover:bg-[#f7f6f3]"
            >
              Към сайта
            </Link>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <AdminTopNav />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">{children}</div>
    </div>
  );
}

