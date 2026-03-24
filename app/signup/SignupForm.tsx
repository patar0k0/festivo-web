"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { signupErrorMessage } from "@/app/login/authErrors";

type SignupFormProps = {
  next: string;
};

export function SignupForm({ next }: SignupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
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
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl border border-black/[0.1] bg-white/95 px-4 text-sm outline-none ring-[#0c0e14]/15 transition-all focus:border-black/20 focus:ring-4"
        />
      </label>

      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/50">Повтори паролата</span>
        <input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl border border-black/[0.1] bg-white/95 px-4 text-sm outline-none ring-[#0c0e14]/15 transition-all focus:border-black/20 focus:ring-4"
        />
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
        disabled={isSubmitting}
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
