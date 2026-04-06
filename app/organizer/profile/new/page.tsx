"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import OrganizerOnboardingValueBlock from "@/components/organizer/OrganizerOnboardingValueBlock";
import OrganizerPortalNav from "@/components/organizer/OrganizerPortalNav";
import "@/app/landing.css";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

export default function NewOrganizerProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const needsTurnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/organizers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          website_url: websiteUrl || null,
          email: email || null,
          turnstileToken: needsTurnstile ? turnstileToken : "",
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setTurnstileToken("");
        turnstileRef.current?.reset();
        throw new Error(payload?.error ?? "Грешка при създаване.");
      }
      router.push("/organizer/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспех.");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(pub.page, "min-h-screen px-4 py-8 md:px-6 md:py-12")}>
      <div className={cn(pub.containerNarrow, "space-y-6")}>
        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white/95 to-white/90 p-6 shadow-sm ring-1 ring-emerald-100/40 md:p-8">
          <Link href="/organizer" className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900/45 hover:text-[#0c0e14]">
            ← Начало
          </Link>
          <h1 className={cn(pub.displayH1, "mt-4 text-2xl md:text-3xl")}>Създай организатор</h1>
          <p className={cn(pub.bodySm, "mt-2")}>Регистрирай нова организация във Festivo.</p>
          <div className="mt-6">
            <OrganizerPortalNav variant="onboarding" />
          </div>
        </div>

        <OrganizerOnboardingValueBlock variant="create" />

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-emerald-200/40 bg-white/90 p-6 shadow-sm md:p-8"
        >
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <label className={pub.label}>
            Име на организатора *
            <input
              required
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className={cn(pub.input, "mt-1.5")}
            />
          </label>
          <label className={pub.label}>
            Кратко описание
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              rows={3}
              className={cn(pub.input, "mt-1.5 min-h-[5.5rem] resize-y")}
            />
          </label>
          <label className={pub.label}>
            Уебсайт
            <input
              value={websiteUrl}
              onChange={(ev) => setWebsiteUrl(ev.target.value)}
              type="url"
              placeholder="https://"
              className={cn(pub.input, "mt-1.5")}
            />
          </label>
          <label className={pub.label}>
            Имейл за контакт
            <input
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              type="email"
              className={cn(pub.input, "mt-1.5")}
              aria-describedby="organizer-contact-email-hint"
            />
            <p id="organizer-contact-email-hint" className={cn(pub.caption, "mt-1.5 leading-snug")}>
              Видим е за всички посетители на публичния профил на организатора. Не използвай личен адрес, ако не искаш да е публичен.
            </p>
          </label>
          <TurnstileWidget
            ref={turnstileRef}
            onSuccess={setTurnstileToken}
            onError={() => setTurnstileToken("")}
            onExpire={() => setTurnstileToken("")}
            className="flex min-h-[65px] justify-center"
          />
          <button
            type="submit"
            disabled={busy || (needsTurnstile && !turnstileToken)}
            className={cn(
              "w-full rounded-xl bg-[#0c3d2e] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#052e22] disabled:opacity-50",
              pub.focusRing,
            )}
          >
            {busy ? "Създаване…" : "Създай профил"}
          </button>
        </form>
      </div>
    </div>
  );
}
