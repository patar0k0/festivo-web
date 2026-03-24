"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { loginErrorMessage } from "@/app/login/authErrors";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const minPasswordLen = 8;
  const passwordsMatch = useMemo(
    () => password.length > 0 && confirmPassword.length > 0 && password === confirmPassword,
    [password, confirmPassword],
  );

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      try {
        const supabase = createSupabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session?.user) {
          setError("Невалиден или изтекъл линк за смяна на парола. Поискай нов от страницата за вход.");
        } else {
          setReady(true);
        }
      } catch {
        if (!mounted) return;
        setError("Неуспешна проверка на сесията. Презареди страницата.");
      }
    }

    void checkRecoverySession();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (password.length < minPasswordLen) {
      setError(`Паролата трябва да е поне ${minPasswordLen} символа.`);
      return;
    }

    if (!passwordsMatch) {
      setError("Паролите не съвпадат.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(loginErrorMessage(updateError.message, "Неуспешна смяна на паролата. Опитай отново."));
        return;
      }

      setNotice("Паролата е обновена успешно. Можеш да влезеш с новата парола.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setError("Мрежова грешка. Опитай отново.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      {error ? (
        <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-[#0c0e14]/6 px-3 py-2 text-sm text-[#0c0e14]" role="status">
          {notice}
        </p>
      ) : null}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Нова парола</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={minPasswordLen}
          required
          disabled={!ready || isSubmitting}
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
          minLength={minPasswordLen}
          required
          disabled={!ready || isSubmitting}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm outline-none ring-[#0c0e14]/20 transition-shadow focus:ring-2 disabled:opacity-60"
        />
      </label>

      <button
        type="submit"
        disabled={!ready || isSubmitting}
        className="w-full rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Запис..." : "Смени паролата"}
      </button>

      <p className="text-center text-sm text-black/55">
        <Link href="/login" className="font-medium underline decoration-black/20 underline-offset-2">
          Назад към вход
        </Link>
      </p>
    </form>
  );
}
