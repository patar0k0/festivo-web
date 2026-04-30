"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { StepContainer } from "@/components/organizer/new-festival-wizard/StepContainer";
import { StepHeader } from "@/components/organizer/new-festival-wizard/StepHeader";
import {
  StepNavigation,
  WizardProgressInline,
  type WizardStepMeta,
} from "@/components/organizer/new-festival-wizard/StepNavigation";

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

export type NewFestivalFormData = {
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
  tagsInput: string;
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  ticketUrl: string;
  heroImageUrl: string;
  isFree: boolean;
};

type OrgOption = { id: string; name: string; slug: string };

const FESTIVAL_DRAFT_STORAGE_KEY = "festival_draft";
const DRAFT_VERSION = 1;

type StoredDraftEnvelope = { v: number; data: NewFestivalFormData };

function tryParseLocalDraftPartialFromStorage(): Partial<NewFestivalFormData> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FESTIVAL_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rec = parsed as Record<string, unknown>;
    if (!rec.data || typeof rec.data !== "object" || rec.data === null || Array.isArray(rec.data)) {
      return null;
    }
    const partial = rec.data as Partial<NewFestivalFormData>;
    if (Object.keys(partial).length === 0) return null;
    return partial;
  } catch {
    return null;
  }
}

function mergeDraftPartialIntoBase(base: NewFestivalFormData, data: Partial<NewFestivalFormData>): NewFestivalFormData {
  const draftOrg = typeof data.organizerId === "string" ? data.organizerId.trim() : "";
  return {
    ...base,
    ...data,
    organizerId: draftOrg || base.organizerId,
    isFree: typeof data.isFree === "boolean" ? data.isFree : base.isFree,
  };
}

const WIZARD_STEPS: WizardStepMeta[] = [
  { id: 1, label: "Основна информация", shortLabel: "Основна" },
  { id: 2, label: "Локация", shortLabel: "Локация" },
  { id: 3, label: "Дати и време (задължително)", shortLabel: "Дати" },
  { id: 4, label: "Медия и допълнително", shortLabel: "Медия" },
];

const isValidImageUrl = (url: string) => {
  return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(url);
};

const FIELD_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black";

const LABEL_TEXT_CLASS = "block text-sm font-medium text-gray-700 mb-1";

const CARD_CLASS =
  "w-full max-w-2xl rounded-2xl border border-gray-100 bg-white px-4 py-6 shadow-sm sm:px-6";

function buildInitialFormData(initialDraft: NewFestivalDraftInitial | null, preOrg: string): NewFestivalFormData {
  return {
    organizerId: initialDraft?.organizer_id || preOrg || "",
    title: initialDraft?.title ?? "",
    description: initialDraft?.description ?? "",
    city: initialDraft?.city ?? "",
    startDate: initialDraft?.start_date ?? "",
    endDate: initialDraft?.end_date ?? "",
    startTime: initialDraft?.start_time ?? "",
    endTime: initialDraft?.end_time ?? "",
    locationName: initialDraft?.location_name ?? "",
    address: initialDraft?.address ?? "",
    category: initialDraft?.category ?? "festival",
    tagsInput: initialDraft?.tagsInput ?? "",
    websiteUrl: initialDraft?.website_url ?? "",
    facebookUrl: initialDraft?.facebook_url ?? "",
    instagramUrl: initialDraft?.instagram_url ?? "",
    ticketUrl: initialDraft?.ticket_url ?? "",
    heroImageUrl: initialDraft?.hero_image ?? "",
    isFree: initialDraft?.is_free ?? true,
  };
}

function scrollFocusFirstInvalidFieldForStep(step: number, data: NewFestivalFormData) {
  let firstId: string | null = null;
  if (step === 1) {
    if (!data.organizerId) firstId = "wizard-field-organizer";
    else if (!data.title.trim()) firstId = "wizard-field-title";
    else if (!data.category.trim()) firstId = "wizard-field-category";
  } else if (step === 2 && !data.city.trim()) {
    firstId = "wizard-field-city";
  }

  if (firstId) {
    const el = document.getElementById(firstId);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
      return;
    }
  }

  const selector =
    step === 1
      ? "#wizard-field-organizer, #wizard-field-title, #wizard-field-category"
      : "#wizard-field-city";
  const fallback = document.querySelector<HTMLElement>(selector);
  if (fallback) {
    fallback.scrollIntoView({ behavior: "smooth", block: "center" });
    fallback.focus({ preventScroll: true });
  }
}

function isStepValid(step: number, data: NewFestivalFormData): boolean {
  switch (step) {
    case 1:
      return Boolean(data.organizerId && data.title.trim() && data.category.trim());
    case 2:
      return Boolean(data.city.trim());
    case 3:
    case 4:
      return true;
    default:
      return false;
  }
}

function canSubmitFestival(data: NewFestivalFormData): boolean {
  return Boolean(
    data.organizerId && data.title.trim() && data.city.trim() && data.startDate && data.category.trim(),
  );
}

function buildPortalPayload(data: NewFestivalFormData, heroImage: string | null, tags: string[]) {
  return {
    organizer_id: data.organizerId,
    title: data.title,
    description: data.description,
    city: data.city,
    start_date: data.startDate,
    end_date: data.endDate.trim() ? data.endDate : null,
    start_time: data.startTime.trim() || null,
    end_time: data.endTime.trim() || null,
    location_name: data.locationName || null,
    address: data.address || null,
    category: data.category.trim() || "festival",
    tags,
    website_url: data.websiteUrl || null,
    facebook_url: data.facebookUrl || null,
    instagram_url: data.instagramUrl || null,
    ticket_url: data.ticketUrl || null,
    hero_image: heroImage,
    is_free: data.isFree,
  };
}

const SUBMISSIONS_SUCCESS_REDIRECT = "/organizer/submissions?submitted=1";

function NewFestivalSubmissionInner({ initialDraft }: { initialDraft: NewFestivalDraftInitial | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preOrg = searchParams.get("organizer_id") ?? "";

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [draftId, setDraftId] = useState<string | null>(() => initialDraft?.id ?? null);
  const [currentStep, setCurrentStep] = useState(1);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(() => new Set([1]));
  const [formData, setFormData] = useState<NewFestivalFormData>(() => buildInitialFormData(initialDraft, preOrg));
  const [pendingLocalDraftPartial, setPendingLocalDraftPartial] = useState<Partial<NewFestivalFormData> | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [imageMissingModalOpen, setImageMissingModalOpen] = useState(false);
  const [thumbLoadFailed, setThumbLoadFailed] = useState(false);
  const heroImageUrlInputRef = useRef<HTMLInputElement>(null);
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const skipLocalDraftPersistenceRef = useRef(Boolean(initialDraft?.id));
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const draftDebounceRef = useRef<number | null>(null);
  const submitRedirectTimerRef = useRef<number | null>(null);

  const flushDraftSave = useCallback(() => {
    if (skipLocalDraftPersistenceRef.current) return;
    if (draftDebounceRef.current !== null) {
      clearTimeout(draftDebounceRef.current);
      draftDebounceRef.current = null;
    }
    try {
      const payload: StoredDraftEnvelope = { v: DRAFT_VERSION, data: formDataRef.current };
      localStorage.setItem(FESTIVAL_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  }, []);

  const trimmedHeroImageUrl = formData.heroImageUrl.trim();
  const hasHeroPreview = Boolean(trimmedHeroImageUrl) && !thumbLoadFailed;

  function patchForm<K extends keyof NewFestivalFormData>(key: K, value: NewFestivalFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    setThumbLoadFailed(false);
  }, [trimmedHeroImageUrl]);

  useEffect(() => {
    if (skipLocalDraftPersistenceRef.current) return;
    if (draftDebounceRef.current !== null) {
      clearTimeout(draftDebounceRef.current);
    }
    draftDebounceRef.current = window.setTimeout(() => {
      draftDebounceRef.current = null;
      try {
        const payload: StoredDraftEnvelope = { v: DRAFT_VERSION, data: formDataRef.current };
        localStorage.setItem(FESTIVAL_DRAFT_STORAGE_KEY, JSON.stringify(payload));
      } catch {
        /* ignore quota / private mode */
      }
    }, 500);
    return () => {
      if (draftDebounceRef.current !== null) {
        clearTimeout(draftDebounceRef.current);
        draftDebounceRef.current = null;
      }
    };
  }, [formData]);

  useEffect(() => {
    setVisitedSteps((prev) => {
      if (prev.has(currentStep)) return prev;
      const next = new Set(prev);
      next.add(currentStep);
      return next;
    });
  }, [currentStep]);

  useEffect(() => {
    if (initialDraft) return;
    const partial = tryParseLocalDraftPartialFromStorage();
    if (partial) setPendingLocalDraftPartial(partial);
  }, [initialDraft]);

  useEffect(() => {
    return () => {
      if (submitRedirectTimerRef.current !== null) {
        clearTimeout(submitRedirectTimerRef.current);
      }
    };
  }, []);

  const skipScrollRef = useRef(true);
  useEffect(() => {
    if (skipScrollRef.current) {
      skipScrollRef.current = false;
      return;
    }
    topAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

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
            setFormData((prev) => ({ ...prev, organizerId: payload.organizers![0].id }));
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
      await Promise.resolve();
      flushDraftSave();
      setError("");
      const effectiveHero = options?.forceEmptyHero ? null : trimmedHeroImageUrl || null;
      if (effectiveHero && !isValidImageUrl(effectiveHero)) {
        setError("Невалиден линк към снимка");
        return;
      }
      setBusy(true);
      try {
        const tags = formData.tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const base = buildPortalPayload(formData, effectiveHero, tags);

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
        try {
          localStorage.removeItem(FESTIVAL_DRAFT_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        setSubmitSuccess(true);
        if (submitRedirectTimerRef.current !== null) {
          clearTimeout(submitRedirectTimerRef.current);
        }
        submitRedirectTimerRef.current = window.setTimeout(() => {
          submitRedirectTimerRef.current = null;
          router.push(SUBMISSIONS_SUCCESS_REDIRECT);
          router.refresh();
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неуспех.");
      } finally {
        setBusy(false);
      }
    },
    [draftId, flushDraftSave, formData, router, trimmedHeroImageUrl],
  );

  const redirectAfterSubmitSuccess = useCallback(() => {
    if (submitRedirectTimerRef.current !== null) {
      clearTimeout(submitRedirectTimerRef.current);
      submitRedirectTimerRef.current = null;
    }
    router.push(SUBMISSIONS_SUCCESS_REDIRECT);
    router.refresh();
  }, [router]);

  async function handlePreview() {
    setError("");
    if (!formData.organizerId || !formData.title.trim() || !formData.city.trim() || !formData.startDate) {
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
      const tags = formData.tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const base = buildPortalPayload(formData, trimmedHeroImageUrl || null, tags);

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

  function requestFinalSubmit() {
    setError("");
    if (!canSubmitFestival(formData)) {
      setError("Моля, попълни всички задължителни полета.");
      return;
    }
    const imageUrl = trimmedHeroImageUrl;
    if (imageUrl && !isValidImageUrl(imageUrl)) {
      setError("Невалиден линк към снимка");
      return;
    }
    if (!trimmedHeroImageUrl) {
      flushDraftSave();
      setImageMissingModalOpen(true);
      return;
    }
    void performSubmit();
  }

  function focusHeroImageUrlField() {
    setCurrentStep(4);
    setTimeout(() => {
      heroImageUrlInputRef.current?.focus();
      heroImageUrlInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function goNext() {
    setError("");
    if (!isStepValid(currentStep, formData)) {
      setError("Моля, попълни задължителните полета в тази стъпка.");
      window.requestAnimationFrame(() => scrollFocusFirstInvalidFieldForStep(currentStep, formData));
      return;
    }
    setCurrentStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setError("");
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  function applyPendingLocalDraft() {
    if (!pendingLocalDraftPartial) return;
    const base = buildInitialFormData(initialDraft, preOrg);
    setFormData(mergeDraftPartialIntoBase(base, pendingLocalDraftPartial));
    setPendingLocalDraftPartial(null);
    setError("");
  }

  function startWizardFresh() {
    try {
      localStorage.removeItem(FESTIVAL_DRAFT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const base = buildInitialFormData(null, preOrg);
    setFormData(orgs.length === 1 ? { ...base, organizerId: orgs[0].id } : base);
    setCurrentStep(1);
    setVisitedSteps(new Set([1]));
    setPendingLocalDraftPartial(null);
    setError("");
  }

  const stepCopy = WIZARD_STEPS[currentStep - 1];
  const stepTitle = stepCopy?.label ?? "";
  const stepDescriptions: Record<number, string> = {
    1: "Име, описание, категория и организатор.",
    2: "Град, адрес и място. Координатите се уточняват при модерация при нужда.",
    3: "Начална и крайна дата и час.",
    4: "Снимка, връзки към сайт и социални мрежи, тагове.",
  };

  return (
    <>
      <div ref={topAnchorRef} className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
        <div className={CARD_CLASS}>
          <Link href="/organizer/dashboard" className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 hover:text-gray-900">
            ← Табло
          </Link>
          <div className="mt-4">
            <h1 className="text-xl font-semibold text-gray-900">Добави фестивал</h1>
            <p className="mt-1 text-sm text-gray-600">Попълни информацията стъпка по стъпка и изпрати за преглед от екипа на Festivo</p>
          </div>
        </div>

        {loadError ? (
          <p className="w-full max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{loadError}</p>
        ) : null}

        <div className={`relative ${CARD_CLASS}`}>
          {submitSuccess ? (
            <div
              className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-white/95 px-6 text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-black/10"
              role="status"
              aria-live="polite"
              tabIndex={0}
              onClick={() => redirectAfterSubmitSuccess()}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  redirectAfterSubmitSuccess();
                }
              }}
            >
              <p className="text-base font-semibold text-gray-900">Фестивалът е изпратен успешно.</p>
              <p className="text-sm text-gray-600">Ще получиш имейл при одобрение.</p>
            </div>
          ) : null}

          <WizardProgressInline
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            visitedSteps={visitedSteps}
            onCompletedStepClick={(stepId) => {
              setError("");
              setCurrentStep(stepId);
            }}
          />

          <div className="mt-6 space-y-6">
            {pendingLocalDraftPartial ? (
              <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-700">Имаме запазен чернови вариант</p>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={applyPendingLocalDraft}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black/20"
                  >
                    Продължи
                  </button>
                  <button
                    type="button"
                    onClick={startWizardFresh}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    Започни отначало
                  </button>
                </div>
              </div>
            ) : null}
            <p className="text-xs text-gray-500">* Задължителни полета за съответната стъпка</p>
            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

            {draftId ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Чернова:{" "}
                <Link className="font-medium underline" href={`/organizer/festivals/preview/${draftId}`}>
                  отвори преглед
                </Link>
              </p>
            ) : null}

            <StepContainer stepKey={currentStep}>
              <StepHeader
                title={stepTitle}
                description={stepDescriptions[currentStep]}
                stepIndex={currentStep}
                totalSteps={WIZARD_STEPS.length}
              />

              {currentStep === 1 ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Организатор *</span>
                    <select
                      id="wizard-field-organizer"
                      value={formData.organizerId}
                      onChange={(ev) => patchForm("organizerId", ev.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option value="">— изберете —</option>
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Заглавие *</span>
                    <input
                      id="wizard-field-title"
                      value={formData.title}
                      onChange={(ev) => patchForm("title", ev.target.value)}
                      placeholder="Напр. Фестивал на народните танци – Враца 2026"
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Описание</span>
                    <textarea
                      value={formData.description}
                      onChange={(ev) => patchForm("description", ev.target.value)}
                      rows={4}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Категория *</span>
                    <input
                      id="wizard-field-category"
                      value={formData.category}
                      onChange={(ev) => patchForm("category", ev.target.value)}
                      placeholder="festival"
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="space-y-4">
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Град / населено място *</span>
                    <input
                      id="wizard-field-city"
                      value={formData.city}
                      onChange={(ev) => patchForm("city", ev.target.value)}
                      placeholder="напр. София или Пловдив"
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Място / локация</span>
                    <input
                      value={formData.locationName}
                      onChange={(ev) => patchForm("locationName", ev.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Адрес</span>
                    <input value={formData.address} onChange={(ev) => patchForm("address", ev.target.value)} className={FIELD_CLASS} />
                  </label>
                  <p className="text-sm text-gray-600">
                    Градът е задължителен. Точният адрес ще помогне на хората да намерят фестивала.
                  </p>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Начало</span>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(ev) => patchForm("startDate", ev.target.value)}
                        className={FIELD_CLASS}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Край</span>
                      <input type="date" value={formData.endDate} onChange={(ev) => patchForm("endDate", ev.target.value)} className={FIELD_CLASS} />
                    </label>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Начало (час)</span>
                      <input
                        type="time"
                        step={60}
                        value={formData.startTime}
                        onChange={(ev) => patchForm("startTime", ev.target.value)}
                        className={FIELD_CLASS}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Край (час)</span>
                      <input type="time" step={60} value={formData.endTime} onChange={(ev) => patchForm("endTime", ev.target.value)} className={FIELD_CLASS} />
                    </label>
                  </div>
                  <p className="text-sm text-gray-600">Можеш да прегледаш фестивала преди изпращане</p>
                </div>
              ) : null}

              {currentStep === 4 ? (
                <div className="space-y-6">
                  <div>
                    <span className={LABEL_TEXT_CLASS}>Снимка (препоръчително)</span>
                    <p className="text-xs text-gray-500">Фестивалите със снимка се разглеждат значително повече</p>
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-stretch">
                      <button
                        type="button"
                        onClick={() => {
                          heroImageUrlInputRef.current?.focus();
                          heroImageUrlInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
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
                          value={formData.heroImageUrl}
                          onChange={(ev) => patchForm("heroImageUrl", ev.target.value)}
                          type="url"
                          placeholder="https://"
                          className={FIELD_CLASS}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-gray-100 pt-6">
                    <h3 className="text-sm font-semibold text-gray-900">Връзки</h3>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Уебсайт</span>
                      <input
                        value={formData.websiteUrl}
                        onChange={(ev) => patchForm("websiteUrl", ev.target.value)}
                        type="url"
                        placeholder="https://"
                        className={FIELD_CLASS}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Facebook</span>
                      <input
                        value={formData.facebookUrl}
                        onChange={(ev) => patchForm("facebookUrl", ev.target.value)}
                        type="url"
                        placeholder="https://"
                        className={FIELD_CLASS}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Instagram</span>
                      <input
                        value={formData.instagramUrl}
                        onChange={(ev) => patchForm("instagramUrl", ev.target.value)}
                        type="url"
                        placeholder="https://"
                        className={FIELD_CLASS}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_TEXT_CLASS}>Билети / линк</span>
                      <input
                        value={formData.ticketUrl}
                        onChange={(ev) => patchForm("ticketUrl", ev.target.value)}
                        type="url"
                        placeholder="https://"
                        className={FIELD_CLASS}
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className={LABEL_TEXT_CLASS}>Тагове</span>
                    <input
                      value={formData.tagsInput}
                      onChange={(ev) => patchForm("tagsInput", ev.target.value)}
                      placeholder="отделени със запетая"
                      className={FIELD_CLASS}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isFree}
                      onChange={(ev) => patchForm("isFree", ev.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-black focus:ring-2 focus:ring-black/10"
                    />
                    <span className="text-sm font-medium text-gray-700">Безплатно събитие</span>
                  </label>
                </div>
              ) : null}
            </StepContainer>

            <StepNavigation
              showBack={currentStep > 1}
              isLastStep={currentStep === 4}
              busy={busy}
              disableNext={!isStepValid(currentStep, formData)}
              disableSubmit={busy || !orgs.length || !canSubmitFestival(formData)}
              onBack={goBack}
              onNext={goNext}
              onSubmit={requestFinalSubmit}
              submitPrepSlot={
                currentStep === 4 ? (
                  <div className="w-full space-y-1 text-sm text-gray-600 sm:text-right">
                    <p className="font-medium">След изпращане:</p>
                    <ul className="list-none space-y-0.5 sm:ml-0">
                      <li>• Ще прегледаме фестивала ти</li>
                      <li>• Ще получиш имейл при одобрение</li>
                    </ul>
                  </div>
                ) : null
              }
              previewSlot={
                currentStep === 4 ? (
                  <button
                    type="button"
                    onClick={() => void handlePreview()}
                    disabled={!orgs.length || busy}
                    className="inline-flex w-full justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10 disabled:opacity-50 sm:w-auto"
                  >
                    {busy ? "Запис…" : "Преглед"}
                  </button>
                ) : null
              }
              footerNote={<p className="text-center text-xs text-gray-500 sm:text-right">След одобрение можеш да промотираш фестивала си</p>}
            />
          </div>
        </div>
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
