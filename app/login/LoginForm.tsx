"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { loginErrorMessage } from "./authErrors";

type LoginFormProps = {
  next: string;
};

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M2.3 12s3.6-6.3 9.7-6.3 9.7 6.3 9.7 6.3-3.6 6.3-9.7 6.3S2.3 12 2.3 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M3 3l18 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M9.6 5.9A10.6 10.6 0 0112 5.7c6.1 0 9.7 6.3 9.7 6.3a16.5 16.5 0 01-3.1 3.9M6.2 8.2A16.7 16.7 0 002.3 12s3.6 6.3 9.7 6.3c1.3 0 2.5-.2 3.5-.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.7h5.5a4.9 4.9 0 01-2.1 3.2v2.7h3.4c2-1.8 3-4.6 3-7.6z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.4-2.7a6 6 0 01-9-3.2H2.7v2.8A10 10 0 0012 22z"
        fill="#34A853"
      />
      <path
        d="M6.2 13.7a6 6 0 010-3.5V7.4H2.7a10 10 0 000 9.1l3.5-2.8z"
        fill="#FBBC05"
      />
      <path
        d="M12 6a5.5 5.5 0 013.9 1.5l2.9-2.9A10 10 0 002.7 7.4l3.5 2.8A6 6 0 0112 6z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M16.4 12.8c0-2.1 1.8-3.1 1.8-3.2-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.9-3.5 2.2-1.5 2.6-.4 6.4 1.1 8.6.8 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-.9 2.8-2 .9-1.2 1.2-2.4 1.2-2.4-.1 0-2.9-1.1-2.9-3.8zM14.3 6.6c.7-.8 1.2-1.9 1-3.1-1 .1-2.2.7-2.9 1.5-.7.7-1.3 1.9-1.1 3 1.1.1 2.2-.6 3-1.4z"
        fill="currentColor"
      />
    </svg>
  );
}

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "apple" | null>(null);
  const [devRedirectHint, setDevRedirectHint] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      setDevRedirectHint(`${window.location.origin}/auth/callback`);
    }
  }, []);

  async function signInWithOAuth(provider: "google" | "apple") {
    setBannerError("");
    setResetNotice("");
    setOauthProvider(provider);

    try {
      const supabase = createSupabaseBrowser();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
      const callbackUrl = new URL("/auth/callback", origin);
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      if (safeNext) {
        callbackUrl.searchParams.set("next", safeNext);
      }
      const redirectTo = callbackUrl.toString();

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (oauthError) {
        setBannerError(loginErrorMessage(oauthError.message, "Входът с външен акаунт не бе успешен. Опитай отново."));
        return;
      }

      if (data?.url) {
        window.location.replace(data.url);
        return;
      }

      setBannerError("Липсва адрес за пренасочване от сървъра. Провери настройките в Supabase.");
    } catch (e) {
      setBannerError(
        e instanceof Error ? loginErrorMessage(e.message, "Неочаквана грешка. Опитай отново.") : "Неочаквана грешка. Опитай отново.",
      );
    } finally {
      setOauthProvider(null);
    }
  }

  async function sendPasswordReset() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setBannerError("Въведи имейл, за да получиш линк за нова парола.");
      return;
    }

    setBannerError("");
    setResetNotice("");
    setIsResetSubmitting(true);

    try {
      const supabase = createSupabaseBrowser();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
      const redirectTo = new URL("/reset-password", origin).toString();

      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (error) {
        setBannerError(loginErrorMessage(error.message, "Не успяхме да изпратим имейл. Опитай отново след малко."));
        return;
      }

      setResetNotice("Изпратихме линк за нова парола. Провери имейла си.");
    } catch {
      setBannerError("Мрежова грешка. Опитай отново.");
    } finally {
      setIsResetSubmitting(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setBannerError("");
    setResetNotice("");

    try {
      const supabase = createSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setBannerError(loginErrorMessage(signInError.message, "Входът не бе успешен. Провери данните."));
        return;
      }

      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.push(target);
      router.refresh();
    } catch {
      setBannerError("Мрежова грешка. Опитай отново.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const oauthBusy = oauthProvider !== null;

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <label className="block" htmlFor={emailId}>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Имейл</span>
        <input
          id={emailId}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl border border-black/[0.1] bg-white/95 px-4 text-sm outline-none ring-[#0c0e14]/15 transition-all focus:border-black/20 focus:ring-4"
        />
      </label>
      <div className="block">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <label htmlFor={passwordId} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">
            Парола
          </label>
        </div>
        <div className="relative">
          <input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-black/[0.1] bg-white/95 px-4 pr-12 text-sm outline-none ring-[#0c0e14]/15 transition-all focus:border-black/20 focus:ring-4"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-black/45 transition hover:bg-black/[0.05] hover:text-black/80"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Скрий паролата" : "Покажи паролата"}
          >
            {showPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void sendPasswordReset()}
          disabled={isResetSubmitting || isSubmitting || oauthBusy}
          className="text-xs font-medium text-black/50 underline decoration-black/20 underline-offset-2 hover:text-black/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResetSubmitting ? "Изпращане..." : "Забравена парола?"}
        </button>
      </div>

      {bannerError ? (
        <p className="rounded-xl bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
          {bannerError}
        </p>
      ) : null}
      {resetNotice ? (
        <p className="rounded-xl bg-[#0c0e14]/6 px-3 py-2 text-sm text-[#0c0e14]" role="status">
          {resetNotice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || oauthBusy || isResetSubmitting}
        className="h-12 w-full rounded-2xl bg-[#0c0e14] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Влизане..." : "Вход с парола"}
      </button>

      <div className="relative py-1 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-black/40 before:absolute before:left-0 before:top-1/2 before:h-px before:w-[40%] before:bg-black/[0.08] after:absolute after:right-0 after:top-1/2 after:h-px after:w-[40%] after:bg-black/[0.08]">
        или
      </div>

      <button
        type="button"
        disabled={oauthBusy || isSubmitting || isResetSubmitting}
        onClick={() => void signInWithOAuth("google")}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.12] bg-white px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <GoogleIcon />
        <span>{oauthProvider === "google" ? "Пренасочване..." : "Продължи с Google"}</span>
      </button>
      <button
        type="button"
        disabled={oauthBusy || isSubmitting || isResetSubmitting}
        onClick={() => void signInWithOAuth("apple")}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.12] bg-white px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <AppleIcon />
        <span>{oauthProvider === "apple" ? "Пренасочване..." : "Продължи с Apple"}</span>
      </button>

      {devRedirectHint ? (
        <p className="text-center text-[11px] leading-relaxed text-black/45">
          Dev: allowlist в Supabase за redirect - <span className="break-all font-mono">{devRedirectHint}</span>
        </p>
      ) : null}

      <p className="pt-1 text-center text-sm text-black/60">
        Нямаш профил?{" "}
        <a href="/signup" className="font-semibold text-black/80 underline decoration-black/20 underline-offset-2">
          Регистрация
        </a>
      </p>
    </form>
  );
}
