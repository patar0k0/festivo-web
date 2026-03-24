import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/authUser";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const target = safeNext ?? "/";

  const user = await getOptionalUser();
  if (user && safeNext) {
    redirect(safeNext);
  }

  return (
    <div className="landing-bg min-h-screen px-4 py-10 text-[#0c0e14]">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-black/[0.08] bg-white/90 p-6 shadow-[0_2px_0_rgba(12,14,20,0.04),0_16px_36px_rgba(12,14,20,0.1)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black tracking-tight">Регистрация</h1>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-black/[0.12] bg-white px-3 text-xs font-semibold uppercase tracking-[0.14em] text-black/75 transition hover:bg-black/[0.03] hover:text-black"
          >
            <span aria-hidden="true">←</span>
            Назад
          </Link>
        </div>
        <p className="mt-2 text-sm text-black/65">Създай профил, за да ползваш Моят план и напомняния.</p>

        <SignupForm next={target} />
      </div>
    </div>
  );
}
