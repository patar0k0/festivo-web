import { getOptionalUser } from "@/lib/authUser";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

const URL_ERROR_MESSAGES: Record<string, string> = {
  oauth: "Входът с Google/Apple не бе завършен. Опитай отново.",
};

const POST_LOGIN_PLAN_ACTIONS = new Set(["add_festival", "add_item", "set_reminder"]);
const POST_LOGIN_REMINDER_TYPES = new Set(["24h", "same_day_09", "none"]);

/**
 * `/login?next=/path&action=...&id=...&type=...` — merge plan-intent params into `next`
 * so email/OAuth return preserves them (LoginForm and `/auth/callback` only receive `next`).
 */
function buildPostLoginRedirect(
  baseNext: string | null,
  planAction: string | undefined,
  planId: string | undefined,
  planType: string | undefined,
): string {
  const safe = baseNext && baseNext.startsWith("/") && !baseNext.startsWith("//") ? baseNext : "/";
  const url = new URL(safe, "https://placeholder.invalid");
  url.searchParams.delete("action");
  url.searchParams.delete("id");
  url.searchParams.delete("type");

  if (!planAction || !POST_LOGIN_PLAN_ACTIONS.has(planAction)) {
    return `${url.pathname}${url.search}`;
  }

  url.searchParams.set("action", planAction);

  if (planId) {
    const trimmed = planId.trim();
    if (trimmed.length > 0 && trimmed.length <= 96 && !/[\s<>"']/.test(trimmed)) {
      url.searchParams.set("id", trimmed);
    }
  }

  if (planType && POST_LOGIN_REMINDER_TYPES.has(planType)) {
    url.searchParams.set("type", planType);
  }

  return `${url.pathname}${url.search}`;
}

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
  const planAction = typeof params.action === "string" ? params.action : undefined;
  const planId = typeof params.id === "string" ? params.id : undefined;
  const planType = typeof params.type === "string" ? params.type : undefined;
  const hasPlanIntent = Boolean(planAction && POST_LOGIN_PLAN_ACTIONS.has(planAction));
  const afterLoginTarget = buildPostLoginRedirect(safeNext, planAction, planId, planType);

  const user = await getOptionalUser();
  if (user && (safeNext || hasPlanIntent)) {
    redirect(afterLoginTarget);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4f0] px-4 text-[#0c0e14]">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-1 w-12 rounded-full bg-[#7c2d12]" aria-hidden="true" />
          <Link href="/" className="shrink-0 text-sm font-medium text-black/50 transition hover:text-black/80">
            ← Начало
          </Link>
        </div>

        <h1 className="text-xl font-semibold tracking-tight text-black">Влез в профила си</h1>
        <p className="mt-1 text-sm text-black/60">за да запазваш фестивали и да получаваш напомняния</p>

        {errorMessage ? (
          <p className="mt-4 rounded-xl bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {user ? (
          <div className="mt-6 space-y-4">
            <p className="rounded-xl bg-black/[0.04] px-3 py-2 text-sm text-[#0c0e14]">Имаш активна сесия.</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin"
                className="inline-flex rounded-full bg-[#7c2d12] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
              >
                Към админ
              </Link>
              <Link
                href="/"
                className="inline-flex rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.03]"
              >
                Начало
              </Link>
            </div>
          </div>
        ) : (
          <LoginForm next={afterLoginTarget.startsWith("/") ? afterLoginTarget : "/"} />
        )}
      </div>
    </div>
  );
}
