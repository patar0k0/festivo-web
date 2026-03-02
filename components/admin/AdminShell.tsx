import Link from "next/link";

export default function AdminShell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <div className="landing-bg min-h-screen text-[#0c0e14]">
      <div className="border-b border-black/[0.08] bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Festivo Admin</p>
            <p className="text-sm text-black/60">{email ?? "admin"}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
            <Link href="/admin" className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 hover:bg-[#f7f6f3]">
              Dashboard
            </Link>
            <Link href="/admin/festivals" className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 hover:bg-[#f7f6f3]">
              Festivals
            </Link>
            <Link href="/admin/logout" className="rounded-xl bg-[#0c0e14] px-3 py-2 text-white hover:bg-[#1d202b]">
              Logout
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-8">{children}</div>
    </div>
  );
}
