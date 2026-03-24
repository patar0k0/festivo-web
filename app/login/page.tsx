import { getOptionalUser } from "@/lib/authUser";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/app/auth/_components/AuthCard";
import { LoginForm } from "./LoginForm";

const URL_ERROR_MESSAGES: Record<string, string> = {
  oauth: "Входът с Google/Apple не бе завършен. Опитай отново.",
};

function messageForUrlError(code: string): string {
  return URL_ERROR_MESSAGES[code] ?? "Възникна грешка при вход. Опитай отново.";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : "";
  const errorMessage = errorCode ? messageForUrlError(errorCode) : "";
  const next = typeof params.next === "string" ? params.next : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const target = safeNext ?? "/";

  const user = await getOptionalUser();
  if (user) {
    if (safeNext) {
      redirect(safeNext);
    }
  }

  return (
    <AuthCard title="Вход" subtitle="Влез, за да ползваш Моят план и напомняния.">

        {errorMessage ? (
          <p className="mt-4 rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {user ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-xl bg-[#0c0e14]/5 px-3 py-2 text-sm text-[#0c0e14]">Имаш активна сесия.</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-xl bg-[#0c0e14] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-white"
              >
                Към админ
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-black/[0.12] bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14]"
              >
                Начало
              </Link>
            </div>
          </div>
        ) : (
          <LoginForm next={target} />
        )}
    </AuthCard>
  );
}
