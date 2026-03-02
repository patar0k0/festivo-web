import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/isAdmin";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Невалидни данни за вход.",
  not_admin: "Нямаш admin достъп.",
  supabase_not_configured: "Липсва Supabase конфигурация.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAdminSession();
  if (session.isAdmin) {
    redirect("/admin");
  }

  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : "";
  const messageParam = typeof params.message === "string" ? params.message : "";
  const error = ERROR_MESSAGES[errorKey] ?? messageParam;

  return (
    <div className="landing-bg min-h-screen px-4 py-12 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-black/[0.08] bg-white/85 p-6 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Festivo Admin</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Вход</h1>
        <p className="mt-2 text-sm text-black/65">Само потребители с admin роля имат достъп.</p>

        {error ? <p className="mt-4 rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

        <form action="/api/admin/auth/login" method="post" className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Email</span>
            <input
              type="email"
              name="email"
              required
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Парола</span>
            <input
              type="password"
              name="password"
              required
              className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff4c1f]/25"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#1d202b]"
          >
            Влез
          </button>
        </form>
      </div>
    </div>
  );
}

