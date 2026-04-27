"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import FestivalDetailClient from "@/components/festival/FestivalDetailClient";
import Container from "@/components/ui/Container";
import Section from "@/components/ui/Section";
import type { Festival } from "@/lib/types";
import { pub } from "@/lib/public-ui/styles";

type OrgOption = { id: string; name: string; slug: string };

const isValidImageUrl = (url: string) => {
  return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(url);
};

const FIELD_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black";

const LABEL_TEXT_CLASS = "block text-sm font-medium text-gray-700 mb-1";

const SECTION_TITLE_CLASS = "text-sm font-semibold text-gray-900 mb-2";

const CARD_CLASS =
  "w-full rounded-2xl border border-gray-100 bg-white px-4 py-6 shadow-sm sm:px-6";

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
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const heroImageUrlInputRef = useRef<HTMLInputElement>(null);

  const trimmedHeroImageUrl = heroImageUrl.trim();
  const hasHeroPreview = Boolean(trimmedHeroImageUrl) && !thumbLoadFailed;

  const selectedOrganizer = useMemo(
    () => orgs.find((o) => o.id === organizerId),
    [orgs, organizerId],
  );

  const previewFestival: Festival = useMemo(
    () => ({
      id: "preview",
      slug: "preview",
      title: title.trim() || "Без заглавие",
      description: description.trim() || "",
      location_name: locationName.trim() || null,
      address: address.trim() || null,
      cities: city.trim()
        ? {
            name_bg: city.trim(),
            slug: null,
          }
        : null,
      organizer_name: selectedOrganizer?.name ?? "",
      organizer: selectedOrganizer
        ? { id: selectedOrganizer.id, name: selectedOrganizer.name, slug: selectedOrganizer.slug }
        : null,
      start_date: startDate.trim() || null,
      end_date: endDate.trim() || null,
      start_time: startTime.trim() ? `${startTime.trim()}:00` : null,
      end_time: endTime.trim() ? `${endTime.trim()}:00` : null,
      hero_image: trimmedHeroImageUrl || null,
      image_url: trimmedHeroImageUrl || null,
      category: category.trim() || null,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      is_free: isFree,
      website_url: websiteUrl.trim() || null,
      ticket_url: ticketUrl.trim() || null,
    }),
    [
      title,
      description,
      locationName,
      address,
      city,
      selectedOrganizer,
      startDate,
      endDate,
      startTime,
      endTime,
      trimmedHeroImageUrl,
      category,
      tagsInput,
      isFree,
      websiteUrl,
      ticketUrl,
    ],
  );

  const previewCalendarMonth = startDate.trim().length >= 7 ? startDate.trim().slice(0, 7) : null;

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
    if (!organizerId || !title.trim() || !city.trim() || !startDate) {
      setError("Моля, попълни всички задължителни полета.");
      setMode("edit");
      return;
    }
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
    <>
      {mode === "edit" ? (
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className={CARD_CLASS}>
            <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 hover:text-gray-900">
              ← Табло
            </Link>
            <div className="mt-4">
              <h1 className="text-xl font-semibold text-gray-900">Нов фестивал</h1>
              <p className="mt-1 text-sm text-gray-600">Попълни информацията и изпрати за преглед от екипа на Festivo</p>
            </div>
          </div>

          {loadError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</p>
          ) : null}

          <form onSubmit={handleSubmit} className={CARD_CLASS}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">* Задължителни полета</p>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          <label className="block">
            <span className={LABEL_TEXT_CLASS}>Организатор *</span>
            <select required value={organizerId} onChange={(ev) => setOrganizerId(ev.target.value)} className={FIELD_CLASS}>
              <option value="">— изберете —</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8">
          <h3 className={SECTION_TITLE_CLASS}>Основна информация</h3>
          <div className="space-y-4">
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Заглавие *</span>
              <input
                required
                value={title}
                onChange={(ev) => setTitle(ev.target.value)}
                placeholder="Напр. Фестивал на народните танци – Враца 2026"
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Описание</span>
              <textarea value={description} onChange={(ev) => setDescription(ev.target.value)} rows={4} className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Категория</span>
              <input value={category} onChange={(ev) => setCategory(ev.target.value)} placeholder="festival" className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Тагове</span>
              <input
                value={tagsInput}
                onChange={(ev) => setTagsInput(ev.target.value)}
                placeholder="отделени със запетая"
                className={FIELD_CLASS}
              />
            </label>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8">
          <h3 className={SECTION_TITLE_CLASS}>Локация</h3>
          <div className="space-y-4">
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Град / населено място *</span>
              <input
                required
                value={city}
                onChange={(ev) => setCity(ev.target.value)}
                placeholder="напр. София или Пловдив"
                className={FIELD_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Място / локация</span>
              <input value={locationName} onChange={(ev) => setLocationName(ev.target.value)} className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Адрес</span>
              <input value={address} onChange={(ev) => setAddress(ev.target.value)} className={FIELD_CLASS} />
            </label>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8">
          <h3 className={SECTION_TITLE_CLASS}>Дати</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Начало *</span>
              <input required type="date" value={startDate} onChange={(ev) => setStartDate(ev.target.value)} className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Край</span>
              <input type="date" value={endDate} onChange={(ev) => setEndDate(ev.target.value)} className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Начало (час)</span>
              <input type="time" step={60} value={startTime} onChange={(ev) => setStartTime(ev.target.value)} className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Край (час)</span>
              <input type="time" step={60} value={endTime} onChange={(ev) => setEndTime(ev.target.value)} className={FIELD_CLASS} />
            </label>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8">
          <h3 className={SECTION_TITLE_CLASS}>Медия</h3>
          <div className="space-y-4">
            <div>
              <span className={LABEL_TEXT_CLASS}>Снимка (препоръчително)</span>
              <p className="text-xs text-gray-500">Фестивалите със снимка се разглеждат значително повече</p>
              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-stretch">
                <button
                  type="button"
                  onClick={focusHeroImageUrlField}
                  className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10 ${
                    hasHeroPreview
                      ? "h-36 w-full border border-gray-300 sm:h-auto sm:w-44 sm:min-h-[9rem]"
                      : "h-36 w-full border-2 border-dashed border-gray-300 sm:w-44"
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
                    <span className="px-3 text-center text-sm font-medium text-gray-500">+ Добави снимка</span>
                  )}
                </button>
                <label className="block min-w-0 flex-1">
                  <span className={LABEL_TEXT_CLASS}>Линк към снимка</span>
                  <input
                    ref={heroImageUrlInputRef}
                    value={heroImageUrl}
                    onChange={(ev) => setHeroImageUrl(ev.target.value)}
                    type="url"
                    placeholder="https://"
                    className={FIELD_CLASS}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-6 sm:mt-8 sm:pt-8">
          <h3 className={SECTION_TITLE_CLASS}>Връзки</h3>
          <div className="space-y-4">
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Уебсайт</span>
              <input value={websiteUrl} onChange={(ev) => setWebsiteUrl(ev.target.value)} type="url" placeholder="https://" className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Facebook</span>
              <input value={facebookUrl} onChange={(ev) => setFacebookUrl(ev.target.value)} type="url" placeholder="https://" className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Instagram</span>
              <input value={instagramUrl} onChange={(ev) => setInstagramUrl(ev.target.value)} type="url" placeholder="https://" className={FIELD_CLASS} />
            </label>
            <label className="block">
              <span className={LABEL_TEXT_CLASS}>Билети / линк</span>
              <input value={ticketUrl} onChange={(ev) => setTicketUrl(ev.target.value)} type="url" placeholder="https://" className={FIELD_CLASS} />
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isFree}
                onChange={(ev) => setIsFree(ev.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-black focus:ring-2 focus:ring-black/10"
              />
              <span className="text-sm font-medium text-gray-700">Безплатно събитие</span>
            </label>
          </div>
        </div>

            <div className="mt-6 flex flex-col items-stretch gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setMode("preview");
                }}
                disabled={!orgs.length}
                className="mt-6 inline-flex w-full justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:mt-0 sm:w-auto"
              >
                Преглед
              </button>
              <p className="text-center text-xs text-gray-500 sm:text-right">След одобрение можеш да промотираш фестивала си</p>
            </div>
          </form>
        </div>
      ) : null}

      {mode === "preview" ? (
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}
          <p className="text-xs text-gray-500">Публичен изглед</p>
          <div className={pub.page}>
            <Section className={pub.section}>
              <Container>
                <FestivalDetailClient
                  festival={previewFestival}
                  media={[]}
                  days={[]}
                  scheduleItems={[]}
                  mapHref={null}
                  mapEmbedSrc={null}
                  citySlug={null}
                  calendarMonth={previewCalendarMonth}
                  relatedFestivals={[]}
                  accommodationOffers={[]}
                  adminEditHref={null}
                  showTravelPopularLabel={false}
                  programItemPlanActions={false}
                  previewMode
                />
              </Container>
            </Section>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:justify-end sm:px-4">
            <button type="button" onClick={() => setMode("edit")} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
              Редактирай
            </button>

            <button
              type="submit"
              disabled={busy || !orgs.length}
              className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 disabled:opacity-50"
            >
              {busy ? "Изпращане…" : "Изпрати за одобрение"}
            </button>
          </form>
        </div>
      ) : null}

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
    </>
  );
}

export default function NewFestivalSubmissionClient() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-black/55">Зареждане…</div>}>
      <NewFestivalSubmissionInner />
    </Suspense>
  );
}
