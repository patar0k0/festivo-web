"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import OrganizerOnboardingValueBlock from "@/components/organizer/OrganizerOnboardingValueBlock";
import OrganizerPortalNav from "@/components/organizer/OrganizerPortalNav";
import "@/app/landing.css";

export default function NewOrganizerProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Грешка при създаване.");
      }
      router.push("/organizer/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспех.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/90 via-white/95 to-white/90 p-6 shadow-sm ring-1 ring-emerald-100/40 md:p-8">
          <Link href="/organizer" className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-900/45 hover:text-[#0c0e14]">
            ← Начало
          </Link>
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold text-[#0c0e14]">Създай организатор</h1>
          <p className="mt-2 text-sm text-black/65">Регистрирай нова организация във Festivo.</p>
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
          <label className="block text-sm font-medium text-[#0c0e14]">
            Име на организатора *
            <input
              required
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Кратко описание
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Уебсайт
            <input
              value={websiteUrl}
              onChange={(ev) => setWebsiteUrl(ev.target.value)}
              type="url"
              placeholder="https://"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Имейл за контакт
            <input
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              type="email"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
              aria-describedby="organizer-contact-email-hint"
            />
            <p id="organizer-contact-email-hint" className="mt-1.5 text-xs leading-snug text-black/55">
              Видим е за всички посетители на публичния профил на организатора. Не използвай личен адрес, ако не искаш да е публичен.
            </p>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#0c3d2e] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#052e22] disabled:opacity-50"
          >
            {busy ? "Създаване…" : "Създай профил"}
          </button>
        </form>
      </div>
    </div>
  );
}
