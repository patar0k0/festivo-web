"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function signInWithOAuth(provider: "google" | "apple") {
    setError("");

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });

      if (oauthError) {
        setError("OAuth login failed.");
      }
    } catch {
      setError("OAuth login failed.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, next }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Invalid login credentials.");
        return;
      }

      const target = next && next.startsWith("/") ? next : "/";
      router.push(target);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Email</span>
        <input
          type="email"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Password</span>
        <input
          type="password"
          name="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm"
        />
      </label>
      {error ? <p className="rounded-lg bg-[#ff4c1f]/10 px-3 py-2 text-sm text-[#b13a1a]">{error}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-[#0c0e14] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => void signInWithOAuth("google")}
        className="w-full rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14]"
      >
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => void signInWithOAuth("apple")}
        className="w-full rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#0c0e14]"
      >
        Continue with Apple
      </button>
    </form>
  );
}
