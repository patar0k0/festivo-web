"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import OrganizerPortalNav from "@/components/organizer/OrganizerPortalNav";
import "@/app/landing.css";

type OrgOption = { id: string; name: string; slug: string };

function NewFestivalSubmissionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preOrg = searchParams.get("organizer_id") ?? "";

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [organizerId, setOrganizerId] = useState(preOrg);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("festival");
  const [tagsInput, setTagsInput] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [ticketUrl, setTicketUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/organizer/memberships", { credentials: "include" });
        const payload = (await res.json().catch(() => null)) as { organizers?: OrgOption[]; error?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Неуспех при зареждане на организациите.");
        }
        if (!cancelled) {
          setOrgs(payload?.organizers ?? []);
          if (!preOrg && payload?.organizers?.length === 1) {
            setOrganizerId(payload.organizers[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Грешка.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preOrg]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/organizer/pending-festivals", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizer_id: organizerId,
          title,
          description,
          city,
          start_date: startDate,
          end_date: endDate.trim() ? endDate : null,
          start_time: startTime.trim() || null,
          end_time: endTime.trim() || null,
          location_name: locationName || null,
          address: address || null,
          category: category.trim() || "festival",
          tags,
          website_url: websiteUrl || null,
          facebook_url: facebookUrl || null,
          instagram_url: instagramUrl || null,
          ticket_url: ticketUrl || null,
          hero_image: heroImageUrl || null,
          is_free: isFree,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Грешка при подаване.");
      }
      router.push("/organizer/submissions?submitted=1");
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
        <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
          <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-[#0c0e14]">
            ← Табло
          </Link>
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">Нов фестивал</h1>
          <p className="mt-2 text-sm text-black/60">Подаването влиза в опашката за модерация. След одобрение фестивалът се публикува в каталога.</p>
          <div className="mt-6">
            <OrganizerPortalNav />
          </div>
        </div>

        {loadError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <label className="block text-sm font-medium text-[#0c0e14]">
            Организатор *
            <select
              required
              value={organizerId}
              onChange={(ev) => setOrganizerId(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            >
              <option value="">— изберете —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Заглавие *
            <input
              required
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Описание
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              rows={4}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Град / населено място *
            <input
              required
              value={city}
              onChange={(ev) => setCity(ev.target.value)}
              placeholder="напр. София или Пловдив"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Категория
            <input
              value={category}
              onChange={(ev) => setCategory(ev.target.value)}
              placeholder="festival"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Тагове
            <input
              value={tagsInput}
              onChange={(ev) => setTagsInput(ev.target.value)}
              placeholder="отделени със запетая"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Място / локация
            <input
              value={locationName}
              onChange={(ev) => setLocationName(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Адрес
            <input
              value={address}
              onChange={(ev) => setAddress(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[#0c0e14]">
              Начало *
              <input
                required
                type="date"
                value={startDate}
                onChange={(ev) => setStartDate(ev.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-[#0c0e14]">
              Край
              <input
                type="date"
                value={endDate}
                onChange={(ev) => setEndDate(ev.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-[#0c0e14]">
              Начало (час)
              <input
                type="time"
                step={60}
                value={startTime}
                onChange={(ev) => setStartTime(ev.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-[#0c0e14]">
              Край (час)
              <input
                type="time"
                step={60}
                value={endTime}
                onChange={(ev) => setEndTime(ev.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Плакат / снимка (URL)
            <input
              value={heroImageUrl}
              onChange={(ev) => setHeroImageUrl(ev.target.value)}
              type="url"
              placeholder="https://"
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
            Facebook
            <input
              value={facebookUrl}
              onChange={(ev) => setFacebookUrl(ev.target.value)}
              type="url"
              placeholder="https://"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Instagram
            <input
              value={instagramUrl}
              onChange={(ev) => setInstagramUrl(ev.target.value)}
              type="url"
              placeholder="https://"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-[#0c0e14]">
            Билети / линк
            <input
              value={ticketUrl}
              onChange={(ev) => setTicketUrl(ev.target.value)}
              type="url"
              placeholder="https://"
              className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-[#0c0e14]">
            <input type="checkbox" checked={isFree} onChange={(ev) => setIsFree(ev.target.checked)} />
            Безплатно събитие
          </label>
          <button
            type="submit"
            disabled={busy || !orgs.length}
            className="w-full rounded-xl bg-[#0c0e14] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Изпращане…" : "Подай за модерация"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewFestivalSubmissionClient() {
  return (
    <Suspense
      fallback={
        <div className="landing-bg min-h-screen px-4 py-16 text-center text-sm text-black/55">Зареждане…</div>
      }
    >
      <NewFestivalSubmissionInner />
    </Suspense>
  );
}
