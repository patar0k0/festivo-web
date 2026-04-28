"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

export type NewFestivalDraftInitial = {
  id: string;
  organizer_id: string;
  title: string;
  description: string;
  city: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  location_name: string;
  address: string;
  category: string;
  tagsInput: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  ticket_url: string;
  hero_image: string;
  is_free: boolean;
};

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

function buildPortalPayload(args: {
  organizerId: string;
  title: string;
  description: string;
  city: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  locationName: string;
  address: string;
  category: string;
  tags: string[];
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  ticketUrl: string;
  heroImage: string | null;
  isFree: boolean;
}) {
  return {
    organizer_id: args.organizerId,
    title: args.title,
    description: args.description,
    city: args.city,
    start_date: args.startDate,
    end_date: args.endDate.trim() ? args.endDate : null,
    start_time: args.startTime.trim() || null,
    end_time: args.endTime.trim() || null,
    location_name: args.locationName || null,
    address: args.address || null,
    category: args.category.trim() || "festival",
    tags: args.tags,
    website_url: args.websiteUrl || null,
    facebook_url: args.facebookUrl || null,
    instagram_url: args.instagramUrl || null,
    ticket_url: args.ticketUrl || null,
    hero_image: args.heroImage,
    is_free: args.isFree,
  };
}

function NewFestivalSubmissionInner({ initialDraft }: { initialDraft: NewFestivalDraftInitial | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preOrg = searchParams.get("organizer_id") ?? "";

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [draftId, setDraftId] = useState<string | null>(() => initialDraft?.id ?? null);
  const [organizerId, setOrganizerId] = useState(() => initialDraft?.organizer_id || preOrg);
  const [title, setTitle] = useState(() => initialDraft?.title ?? "");
  const [description, setDescription] = useState(() => initialDraft?.description ?? "");
  const [city, setCity] = useState(() => initialDraft?.city ?? "");
  const [startDate, setStartDate] = useState(() => initialDraft?.start_date ?? "");
  const [endDate, setEndDate] = useState(() => initialDraft?.end_date ?? "");
  const [startTime, setStartTime] = useState(() => initialDraft?.start_time ?? "");
  const [endTime, setEndTime] = useState(() => initialDraft?.end_time ?? "");
  const [locationName, setLocationName] = useState(() => initialDraft?.location_name ?? "");
  const [address, setAddress] = useState(() => initialDraft?.address ?? "");
  const [category, setCategory] = useState(() => initialDraft?.category ?? "festival");
  const [tagsInput, setTagsInput] = useState(() => initialDraft?.tagsInput ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(() => initialDraft?.website_url ?? "");
  const [facebookUrl, setFacebookUrl] = useState(() => initialDraft?.facebook_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(() => initialDraft?.instagram_url ?? "");
  const [ticketUrl, setTicketUrl] = useState(() => initialDraft?.ticket_url ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(() => initialDraft?.hero_image ?? "");
  const [isFree, setIsFree] = useState(() => initialDraft?.is_free ?? true);
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
          const initialOrg = initialDraft?.organizer_id;
          if (!initialOrg && !preOrg && payload?.organizers?.length === 1) {
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
  }, [preOrg, initialDraft?.organizer_id]);

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
        const base = buildPortalPayload({
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
          tags,
          websiteUrl,
          facebookUrl,
          instagramUrl,
          ticketUrl,
          heroImage: effectiveHero,
          isFree,
        });

        if (draftId) {
          const patchBody: Record<string, unknown> = {
            title: base.title,
            description: base.description,
            city: base.city,
            start_date: base.start_date,
            end_date: base.end_date,
            start_time: base.start_time,
            end_time: base.end_time,
            location_name: base.location_name,
            address: base.address,
            category: base.category,
            tags: base.tags,
            website_url: base.website_url,
            facebook_url: base.facebook_url,
            instagram_url: base.instagram_url,
            ticket_url: base.ticket_url,
            hero_image: base.hero_image,
            is_free: base.is_free,
            status: "pending",
          };
          const res = await fetch(`/api/organizer/pending-festivals/${draftId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchBody),
          });
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) {
            throw new Error(payload?.error ?? "Грешка при подаване.");
          }
        } else {
          const res = await fetch("/api/organizer/pending-festivals", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(base),
          });
          const payload = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
          if (!res.ok) {
            throw new Error(payload?.error ?? "Грешка при подаване.");
          }
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
      draftId,
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

  async function handlePreview() {
    setError("");
    if (!organizerId || !title.trim() || !city.trim() || !startDate) {
      setError("Моля, попълни всички задължителни полета.");
      return;
    }
    const imageUrl = trimmedHeroImageUrl;
    if (imageUrl && !isValidImageUrl(imageUrl)) {
      setError("Невалиден линк към снимка");
      return;
    }
    setBusy(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const base = buildPortalPayload({
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
        tags,
        websiteUrl,
        facebookUrl,
        instagramUrl,
        ticketUrl,
        heroImage: trimmedHeroImageUrl || null,
        isFree,
      });

      if (draftId) {
        const patchBody: Record<string, unknown> = {
          title: base.title,
          description: base.description,
          city: base.city,
          start_date: base.start_date,
          end_date: base.end_date,
          start_time: base.start_time,
          end_time: base.end_time,
          location_name: base.location_name,
          address: base.address,
          category: base.category,
          tags: base.tags,
          website_url: base.website_url,
          facebook_url: base.facebook_url,
          instagram_url: base.instagram_url,
          ticket_url: base.ticket_url,
          hero_image: base.hero_image,
          is_free: base.is_free,
        };
        const res = await fetch(`/api/organizer/pending-festivals/${draftId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Грешка при запис на прегледа.");
        }
        router.push(`/organizer/festivals/preview/${draftId}`);
        router.refresh();
      } else {
        const res = await fetch("/api/organizer/pending-festivals", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...base,
            status: "draft",
          }),
        });
        const payload = (await res.json().catch(() => null)) as { error?: string; id?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error ?? "Грешка при създаване на чернова.");
        }
        if (payload?.id) {
          setDraftId(payload.id);
          router.push(`/organizer/festivals/preview/${payload.id}`);
          router.refresh();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспех.");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!organizerId || !title.trim() || !city.trim() || !startDate) {
      setError("Моля, попълни всички задължителни полета.");
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
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className={CARD_CLASS}>
          <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 hover:text-gray-900">
            ← Табло
          </Link>
          <div className="mt-4">
            <h1 className="text-xl font-semibold text-gray-900">Добави фестивал</h1>
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
            {draftId ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Чернова:{" "}
                <Link className="font-medium underline" href={`/organizer/festivals/preview/${draftId}`}>
                  отвори преглед
                </Link>
              </p>
            ) : null}
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
              onClick={() => void handlePreview()}
              disabled={!orgs.length || busy}
              className="mt-6 inline-flex w-full justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:mt-0 sm:w-auto"
            >
              {busy ? "Запис…" : "Преглед"}
            </button>
            <button
              type="submit"
              disabled={busy || !orgs.length}
              className="inline-flex w-full justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:w-auto"
            >
              {busy ? "Изпращане…" : "Изпрати за одобрение"}
            </button>
            <p className="text-center text-xs text-gray-500 sm:text-right">След одобрение можеш да промотираш фестивала си</p>
          </div>
        </form>
      </div>

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

export default function NewFestivalSubmissionClient({
  initialDraft = null,
}: {
  initialDraft?: NewFestivalDraftInitial | null;
}) {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-black/55">Зареждане…</div>}>
      <NewFestivalSubmissionInner initialDraft={initialDraft} />
    </Suspense>
  );
}
