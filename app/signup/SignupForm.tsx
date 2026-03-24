"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { OAuthButtons } from "@/app/auth/_components/OAuthButtons";
import { signupErrorMessage } from "@/app/login/authErrors";

type SignupFormProps = {
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

export function SignupForm({ next }: SignupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function continueWithOAuth(provider: "google" | "apple") {
    setError("");
    setNotice("");
    setOauthProvider(provider);
    try {
      const supabase = createSupabaseBrowser();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      const callbackUrl = new URL("/auth/callback", origin);
      callbackUrl.searchParams.set("next", safeNext);

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl.toString() },
      });

      if (oauthError) {
        setError(signupErrorMessage(oauthError.message, "Неуспешна регистрация с външен акаунт. Опитай отново."));
        return;
      }

      if (data?.url) {
        window.location.replace(data.url);
        return;
      }
      setError("Липсва адрес за пренасочване от сървъра. Провери настройките в Supabase.");
    } catch {
      setError("Мрежова грешка. Опитай отново.");
    } finally {
      setOauthProvider(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 8) {
      setError("Паролата трябва да е поне 8 символа.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Паролите не съвпадат.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowser();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      const emailRedirectTo = new URL("/auth/callback", origin);
      emailRedirectTo.searchParams.set("next", safeNext);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: emailRedirectTo.toString() },
      });

      if (signUpError) {
        setError(signupErrorMessage(signUpError.message, "Неуспешна регистрация. Опитай отново."));
        return;
      }

      if (data.session) {
        router.push(safeNext);
        router.refresh();
        return;
      }

      setNotice("Профилът е създаден. Провери имейла си за потвърждение и след това влез.");
    } catch {
      setError("Мрежова грешка. Опитай отново.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const oauthBusy = oauthProvider !== null;

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <OAuthButtons
        oauthProvider={oauthProvider}
        disabled={oauthBusy || isSubmitting}
        onContinue={continueWithOAuth}
      />

      <div className="relative py-1 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-black/40 before:absolute before:left-0 before:top-1/2 before:h-px before:w-[40%] before:bg-black/[0.08] after:absolute after:right-0 after:top-1/2 after:h-px after:w-[40%] after:bg-black/[0.08]">
        или
      </div>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Имейл</span>
        <input
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

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Парола</span>
        <div className="relative mt-2">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
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
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Повтори паролата</span>
        <div className="relative mt-2">
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-black/[0.1] bg-white/95 px-4 pr-12 text-sm outline-none ring-[#0c0e14]/15 transition-all focus:border-black/20 focus:ring-4"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-black/45 transition hover:bg-black/[0.05] hover:text-black/80"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-pressed={showConfirmPassword}
            aria-label={showConfirmPassword ? "Скрий потвърждението" : "Покажи потвърждението"}
          >
            {showConfirmPassword ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </button>
        </div>
      </label>

      {error ? (
        <p className="rounded-xl bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-xl bg-[#0c0e14]/6 px-3 py-2 text-sm text-[#0c0e14]" role="status">
          {notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || oauthBusy}
        className="h-12 w-full rounded-2xl bg-[#0c0e14] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Създаване..." : "Създай профил"}
      </button>

      <p className="text-center text-sm text-black/60">
        Имаш профил?{" "}
        <Link href="/login" className="font-semibold text-black/80 underline decoration-black/20 underline-offset-2">
          Вход
        </Link>
      </p>
    </form>
  );
}
