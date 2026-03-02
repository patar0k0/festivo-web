import { getOptionalUser } from "@/lib/authUser";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const next = typeof params.next === "string" ? params.next : null;
  const safeNext = next && next.startsWith("/") ? next : null;
  const target = safeNext ?? "/";

  const user = await getOptionalUser();
  if (user) {
    if (safeNext) {
      redirect(safeNext);
    }
  }

  return (
    <div className="landing-bg min-h-screen px-4 py-12 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-black/[0.08] bg-white/85 p-6 shadow-[0_2px_0_rgba(12,14,20,0.05),0_10px_24px_rgba(12,14,20,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Festivo</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Вход</h1>
        <p className="mt-2 text-sm text-black/65">Влез, за да ползваш Моят план и напомняния.</p>

        {error ? <p className="mt-4 rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}

        {user ? (
          <div className="mt-5 space-y-3">
            <p className="rounded-lg bg-[#0c0e14]/5 px-3 py-2 text-sm text-[#0c0e14]">Already signed in.</p>
            <div className="flex gap-2">
              <Link href="/admin" className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                Go to admin
              </Link>
              <Link href="/" className="rounded-xl border border-black/[0.12] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14]">
                Go home
              </Link>
            </div>
          </div>
        ) : (
          <LoginForm next={target} />
        )}
      </div>
    </div>
  );
}
