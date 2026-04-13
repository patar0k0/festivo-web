"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

type OrgOption = { id: string; name: string; slug: string };

const isValidImageUrl = (url: string) => {
  return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(url);
};

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
  const [imageMissingModalOpen, setImageMissingModalOpen] = useState(false);
  const [thumbLoadFailed, setThumbLoadFailed] = useState(false);
  const heroImageUrlInputRef = useRef<HTMLInputElement>(null);

  const trimmedHeroImageUrl = heroImageUrl.trim();
  const hasHeroPreview = Boolean(trimmedHeroImageUrl) && !thumbLoadFailed;

  useEffect(() => {
    setThumbLoadFailed(false);
  }, [trimmedHeroImageUrl]);

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

  const performSubmit = useCallback(
    async (options?: { forceEmptyHero?: boolean }) => {
      setError("");
      const effectiveHero = options?.forceEmptyHero ? null : heroImageUrl.trim() || null;
      if (effectiveHero && !isValidImageUrl(effectiveHero)) {
        setError("Невалиден линк към снимка");
        return;
      }
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
            hero_image: effectiveHero,
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
    },
    [
      organizerId,
      title,
      description,
      city,
      startDate,
      endDate,
      startTime,
      endTime,
      locationName,
      address,
      category,
      tagsInput,
      websiteUrl,
      facebookUrl,
      instagramUrl,
      ticketUrl,
      heroImageUrl,
      isFree,
      router,
    ],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const imageUrl = trimmedHeroImageUrl;
    if (imageUrl && !isValidImageUrl(imageUrl)) {
      setError("Невалиден линк към снимка");
      return;
    }
    if (!trimmedHeroImageUrl) {
      setImageMissingModalOpen(true);
      return;
    }
    void performSubmit();
  }

  function focusHeroImageUrlField() {
    heroImageUrlInputRef.current?.focus();
    heroImageUrlInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
        <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45 hover:text-[#0c0e14]">
          ← Табло
        </Link>
        <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold">Нов фестивал</h1>
        <p className="mt-2 text-sm text-black/60">Подаването влиза в опашката за модерация. След одобрение фестивалът се публикува в каталога.</p>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8">
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
        <div className="block">
          <span className="text-sm font-medium text-[#0c0e14]">Снимка (препоръчително)</span>
          <p className="mt-1 text-xs leading-relaxed text-black/55">Фестивалите със снимка се разглеждат значително повече</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <button
              type="button"
              onClick={focusHeroImageUrlField}
              className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/[0.02] transition-colors hover:bg-black/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0c0e14]/20 ${
                hasHeroPreview ? "h-36 w-full border border-black/[0.1] sm:h-auto sm:w-44 sm:min-h-[9rem]" : "h-36 w-full border-2 border-dashed border-black/20 sm:w-44"
              }`}
            >
              {hasHeroPreview ? (
                // eslint-disable-next-line @next/next/no-img-element -- arbitrary URL paste (no remotePatterns guarantee)
                <img
                  src={trimmedHeroImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setThumbLoadFailed(true)}
                />
              ) : (
                <span className="px-3 text-center text-sm font-medium text-black/50">+ Добави снимка</span>
              )}
            </button>
            <label className="block min-w-0 flex-1 text-sm font-medium text-[#0c0e14]">
              Линк към снимка
              <input
                ref={heroImageUrlInputRef}
                value={heroImageUrl}
                onChange={(ev) => setHeroImageUrl(ev.target.value)}
                type="url"
                placeholder="https://"
                className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
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

      {imageMissingModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-festival-image-prompt-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white p-6 shadow-lg">
            <h2 id="new-festival-image-prompt-title" className="font-[var(--font-display)] text-lg font-bold text-[#0c0e14]">
              Добави снимка?
            </h2>
            <p className="mt-2 text-sm text-black/60">Фестивалите със снимка се представят по-добре</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                className="w-full rounded-xl bg-[#0c0e14] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto"
                onClick={() => {
                  setImageMissingModalOpen(false);
                  focusHeroImageUrlField();
                }}
              >
                Добави снимка
              </button>
              <button
                type="button"
                className="w-full rounded-xl border border-black/[0.12] bg-white px-4 py-2.5 text-sm font-semibold text-[#0c0e14] sm:w-auto"
                onClick={() => {
                  setImageMissingModalOpen(false);
                  void performSubmit({ forceEmptyHero: true });
                }}
              >
                Продължи без снимка
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function NewFestivalSubmissionClient() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-black/55">Зареждане…</div>}>
      <NewFestivalSubmissionInner />
    </Suspense>
  );
}
