"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { loginErrorMessage } from "@/app/login/authErrors";

type PageView = "checking" | "form" | "success" | "invalid_link";

const MIN_PASSWORD_LEN = 8;

function hasSupabaseAuthErrorInUrl(): boolean {
  if (typeof window === "undefined") return false;
  const { search, hash } = window.location;
  const searchParams = new URLSearchParams(search);
  if (searchParams.get("error") || searchParams.get("error_code")) {
    return true;
  }
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!fragment) return false;
  const hashParams = new URLSearchParams(fragment);
  return Boolean(hashParams.get("error") || hashParams.get("error_code"));
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pageView, setPageView] = useState<PageView>("checking");
  const [fieldError, setFieldError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successHasSession, setSuccessHasSession] = useState(true);
  const settledRef = useRef(false);
  const invalidTimerRef = useRef<number | null>(null);

  const passwordsMatch = useMemo(
    () => password.length > 0 && confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword],
  );

  useEffect(() => {
    if (hasSupabaseAuthErrorInUrl()) {
      setPageView("invalid_link");
      return;
    }

    settledRef.current = false;
    const timers: number[] = [];

    function clearInvalidTimer() {
      if (invalidTimerRef.current !== null) {
        window.clearTimeout(invalidTimerRef.current);
        invalidTimerRef.current = null;
      }
    }

    function promoteToForm() {
      if (settledRef.current) return;
      settledRef.current = true;
      clearInvalidTimer();
      timers.forEach((t) => window.clearTimeout(t));
      setPageView("form");
    }

    function promoteToInvalid() {
      if (settledRef.current) return;
      settledRef.current = true;
      clearInvalidTimer();
      timers.forEach((t) => window.clearTimeout(t));
      setPageView("invalid_link");
    }

    let unsub: (() => void) | null = null;

    async function run() {
      try {
        const supabase = createSupabaseBrowser();

        const trySession = async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            promoteToForm();
            return true;
          }
          return false;
        };

        if (await trySession()) {
          return;
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            promoteToForm();
          }
        });
        unsub = () => subscription.unsubscribe();

        timers.push(
          window.setTimeout(() => {
            void trySession();
          }, 120),
        );
        timers.push(
          window.setTimeout(() => {
            void trySession();
          }, 500),
        );

        invalidTimerRef.current = window.setTimeout(() => {
          void supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              promoteToForm();
            } else if (!settledRef.current) {
              promoteToInvalid();
            }
          });
        }, 2800);
      } catch {
        promoteToInvalid();
      }
    }

    void run();

    return () => {
      settledRef.current = true;
      clearInvalidTimer();
      timers.forEach((t) => window.clearTimeout(t));
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (pageView !== "success" || !successHasSession) return;

    const redirectTimer: number = window.setTimeout(() => {
      router.push("/profile");
    }, 2200);

    return () => window.clearTimeout(redirectTimer);
  }, [pageView, successHasSession, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || pageView !== "form") return;

    setFieldError("");

    if (password.length < MIN_PASSWORD_LEN) {
      setFieldError(`Паролата трябва да е поне ${MIN_PASSWORD_LEN} символа.`);
      return;
    }

    if (!passwordsMatch) {
      setFieldError("Паролите не съвпадат.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setFieldError(loginErrorMessage(updateError.message, "Неуспешна смяна на паролата. Опитай отново."));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSuccessHasSession(Boolean(session?.user));
      setPassword("");
      setConfirmPassword("");
      setPageView("success");
    } catch {
      setFieldError("Мрежова грешка. Опитай отново.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/45">Festivo</p>

      {pageView === "invalid_link" ? (
        <>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Линкът е невалиден или е изтекъл</h1>
          <p className="mt-2 text-sm text-black/65">
            Поискай нов имейл за смяна на парола от страницата за вход и опитай отново.
          </p>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white"
            >
              Към вход
            </Link>
          </div>
        </>
      ) : pageView === "success" ? (
        <>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Паролата е сменена</h1>
          <p className="mt-2 text-sm text-black/65">Можеш да влезеш с новата си парола.</p>
          {successHasSession ? (
            <>
              <p className="mt-2 text-sm text-black/55">Пренасочваме те към профила…</p>
              <div className="mt-6">
                <Link
                  href="/profile"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white"
                >
                  Към профила
                </Link>
              </div>
            </>
          ) : (
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white"
              >
                Към вход
              </Link>
            </div>
          )}
        </>
      ) : pageView === "checking" ? (
        <>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Нова парола</h1>
          <p className="mt-2 text-sm text-black/65">Проверка на линка…</p>
          <div className="mt-8 flex justify-center py-6" aria-hidden>
            <span className="h-8 w-8 animate-pulse rounded-full bg-black/10" />
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-2xl font-black tracking-tight">Нова парола</h1>
          <p className="mt-2 text-sm text-black/65">Въведи нова парола за профила си.</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
            {fieldError ? (
              <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
                {fieldError}
              </p>
            ) : null}

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Нова парола</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LEN}
                required
                disabled={isSubmitting}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm outline-none ring-[#0c0e14]/20 transition-shadow focus:ring-2 disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Повтори паролата</span>
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LEN}
                required
                disabled={isSubmitting}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm outline-none ring-[#0c0e14]/20 transition-shadow focus:ring-2 disabled:opacity-60"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Смяна…" : "Смени паролата"}
            </button>

            <p className="text-center text-sm text-black/55">
              <Link href="/login" className="font-medium underline decoration-black/20 underline-offset-2">
                Назад към вход
              </Link>
            </p>
          </form>
        </>
      )}
    </>
  );
}
