"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import OrganizerClaimStepStrip from "@/components/organizer/OrganizerClaimStepStrip";
import OrganizerOnboardingValueBlock from "@/components/organizer/OrganizerOnboardingValueBlock";
import OrganizerPortalNav from "@/components/organizer/OrganizerPortalNav";
import "@/app/landing.css";

export default function OrganizerClaimPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/claims", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim() }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Грешка при заявката.");
      }
      setOk(true);
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
        <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white/95 to-white/90 p-6 shadow-sm ring-1 ring-amber-100/50 md:p-8">
          <Link href="/organizer" className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/45 hover:text-[#0c0e14]">
            ← Начало
          </Link>
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold text-[#0c0e14]">Поеми съществуващ профил</h1>
          <p className="mt-2 text-sm text-black/65">
            Организацията ти вече е в Festivo — заяви собственост върху профила. Въведи публичния адрес (slug) — напр. от URL{" "}
            <span className="font-mono text-xs">/organizers/your-slug</span>.
          </p>
          <div className="mt-6">
            <OrganizerPortalNav variant="onboarding" />
          </div>
        </div>

        <OrganizerOnboardingValueBlock variant="claim" />

        <OrganizerClaimStepStrip />

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-amber-200/45 bg-white/90 p-6 shadow-sm md:p-8">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          {ok ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Заявката е изпратена. Ще бъде прегледана от екипа на Festivo.
            </p>
          ) : null}
          <label className="block text-sm font-medium text-[#0c0e14]">
            Slug на профила *
            <input
              required
              value={slug}
              onChange={(ev) => setSlug(ev.target.value)}
              placeholder="напр. ethno-jam"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#7c2d12] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5c200d] disabled:opacity-50"
          >
            {busy ? "Изпращане…" : "Заяви профил"}
          </button>
        </form>

        <p className="text-center text-xs leading-relaxed text-black/50">
          Заявката се преглежда от екипа на Festivo.
          <br />
          Няма да публикуваме промени без ваше одобрение.
        </p>
      </div>
    </div>
  );
}
