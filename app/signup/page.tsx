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
  if (user) {
    redirect(target);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--f-surface)] px-4 py-10 text-[#0c0e14] sm:py-16">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="h-1 w-12 rounded-full bg-[#7c2d12]" aria-hidden="true" />
            <Link href="/" className="shrink-0 text-sm font-medium text-black/50 transition hover:text-black/80">
              ← Начало
            </Link>
          </div>

          <h1 className="text-xl font-semibold tracking-tight text-black">Създай профил</h1>
          <p className="mt-1 text-sm text-black/60">запазвай фестивали и получавай напомняния</p>
        </div>

        <SignupForm next={target} />
      </div>
    </div>
  );
}
