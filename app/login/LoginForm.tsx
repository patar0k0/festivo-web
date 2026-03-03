"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectHint, setRedirectHint] = useState("/auth/callback");

  useEffect(() => {
    setRedirectHint(`${window.location.origin}/auth/callback`);
  }, []);

  async function signInWithOAuth(provider: "google" | "apple") {
    try {
      console.log("ENV CHECK", {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING",
      });
      const supabase = createSupabaseBrowser();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;
      const callbackUrl = new URL("/auth/callback", origin);
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      if (safeNext) {
        callbackUrl.searchParams.set("next", safeNext);
      }
      const redirectTo = callbackUrl.toString();
      console.log("OAuth redirectTo", redirectTo);
      console.log("GOOGLE CLICK", { redirectTo });

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });
      console.log("OAuth signInWithOAuth result", { data, error: oauthError });
      console.log("OAuth result", { provider, url: data?.url, error: oauthError });

      if (oauthError) {
        console.error("OAuth error:", oauthError);
        alert(`OAuth error: ${oauthError.message}`);
        return;
      }

      // OAuth redirect must happen immediately; Fast Refresh in `next dev` can interrupt navigation.
      if (data?.url) {
        window.location.replace(data.url);
        return;
      }

      alert("OAuth error: missing redirect URL from Supabase.");
    } catch (e) {
      console.error("OAuth unexpected error:", e);
      alert(`OAuth unexpected error: ${String(e)}`);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const supabase = createSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Invalid login credentials.");
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
      {process.env.NODE_ENV !== "production" ? (
        <p className="text-xs text-black/55">OAuth redirect URL (allow-list in Supabase): {redirectHint}</p>
      ) : null}
    </form>
  );
}
