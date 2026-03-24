import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { getOptionalUser } from "@/lib/authUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initialsFromEmail(email: string | null): string {
  if (!email) return "U";
  const local = email.split("@")[0] ?? "";
  const chars = local.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
  return chars || "U";
}

export default async function ProfilePage() {
  noStore();
  const user = await getOptionalUser();

  if (!user) {
    return (
      <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-black/[0.08] bg-white/85 p-6 text-center shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h1 className="text-3xl font-black tracking-tight">Профил</h1>
          <p className="mt-3 text-sm text-black/65">Влез, за да видиш и управляваш акаунта си.</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/login"
              className="inline-flex rounded-xl bg-[#0c0e14] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-white"
            >
              Вход
            </Link>
            <Link
              href="/signup"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#0c0e14]"
            >
              Регистрация
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  const isAdmin = Boolean(roleRow);

  return (
    <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-[900px] space-y-5">
        <div className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h1 className="text-3xl font-black tracking-tight">Профил</h1>
          <p className="mt-2 text-sm text-black/65">Управлявай акаунта, известията и бързите действия.</p>
        </div>

        <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-black/55">Акаунт</h2>
          <div className="mt-4 flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0c0e14] text-lg font-extrabold text-white">
              {initialsFromEmail(user.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Имейл</p>
              <p className="mt-1 break-all text-base font-semibold text-[#0c0e14]">{user.email ?? "Няма имейл"}</p>
              <p className="mt-1 text-sm text-black/55">Вход през Supabase Auth (email/password или OAuth).</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-black/55">Бързи действия</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/plan"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
            >
              Моят план
            </Link>
            <Link
              href="/festivals"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
            >
              Фестивали
            </Link>
            {isAdmin ? (
              <Link
                href="/admin"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
              >
                Админ панел
              </Link>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.08] bg-white/85 p-5 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-black/55">Известия и сигурност</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/plan"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
            >
              Настройки за известия
            </Link>
            <Link
              href="/reset-password"
              className="inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
            >
              Смени парола
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="inline-flex rounded-xl border border-black/[0.14] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0c0e14] transition hover:bg-black/[0.04]"
              >
                Изход
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
