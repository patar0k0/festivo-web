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
import OrganizerProgramEditor from "./OrganizerProgramEditor";
import {
  emptyProgramDraft,
  parseProgramDraftUnknown,
  programDraftHasContent,
  programDraftToPublishPayload,
  type ProgramDraft,
} from "@/lib/festival/programDraft";
import type { FestivalCategory } from "@/lib/festivals/categories.server";

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
  video_url: string;
  gallery_image_urls: string[];
  is_free: boolean;
  program_draft: unknown;
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
  videoUrl: string;
  galleryImageUrls: string[];
  isFree: boolean;
  programDraft: ProgramDraft;
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
  { id: 3, label: "Дати и време", shortLabel: "Дати" },
  { id: 4, label: "Програма (по избор)", shortLabel: "Програма" },
  { id: 5, label: "Медия и допълнително", shortLabel: "Медия" },
];

const LAST_STEP = WIZARD_STEPS.length;

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 1000;

const isValidImageUrl = (url: string) => {
  return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(url);
};

// Aligned with /organizer/profile/new + /organizer/claim "pro" aesthetic.
const FIELD_CLASS =
  "w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2.5 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-[#7c2d12]/25";

const LABEL_TEXT_CLASS = "block text-sm font-medium text-[#0c0e14] mb-1.5";

const HELPER_CLASS = "mt-1 text-[11px] text-black/55";

const CARD_CLASS =
  "w-full max-w-2xl rounded-2xl border border-amber-200/50 bg-white/95 px-5 py-6 shadow-sm ring-1 ring-amber-100/35 sm:px-7";

function hydrateInitialProgramDraft(value: unknown): ProgramDraft {
  if (!value) return emptyProgramDraft();
  const parsed = parseProgramDraftUnknown(value);
  return parsed.ok ? parsed.value : emptyProgramDraft();
}

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
    category: initialDraft?.category ?? "",
    tagsInput: initialDraft?.tagsInput ?? "",
    websiteUrl: initialDraft?.website_url ?? "",
    facebookUrl: initialDraft?.facebook_url ?? "",
    instagramUrl: initialDraft?.instagram_url ?? "",
    ticketUrl: initialDraft?.ticket_url ?? "",
    heroImageUrl: initialDraft?.hero_image ?? "",
    videoUrl: initialDraft?.video_url ?? "",
    galleryImageUrls: initialDraft?.gallery_image_urls ?? [],
    isFree: initialDraft?.is_free ?? true,
    programDraft: hydrateInitialProgramDraft(initialDraft?.program_draft),
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
    case 5:
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
  // Strip program_draft to canonical shape (publish payload). If empty → null
  // so the server clears any prior draft data.
  const programDraftOut = programDraftHasContent(data.programDraft)
    ? programDraftToPublishPayload(data.programDraft)
    : null;

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
    video_url: data.videoUrl.trim() || null,
    gallery_image_urls: data.galleryImageUrls,
    is_free: data.isFree,
    program_draft: programDraftOut,
  };
}

const SUBMISSIONS_SUCCESS_REDIRECT = "/organizer/submissions?submitted=1";

function NewFestivalSubmissionInner({
  initialDraft,
  categories = [],
}: {
  initialDraft: NewFestivalDraftInitial | null;
  categories?: FestivalCategory[];
}) {
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
  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const [heroUploadBusy, setHeroUploadBusy] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState("");
  const [galleryUploadBusy, setGalleryUploadBusy] = useState(false);
  const [galleryUploadError, setGalleryUploadError] = useState("");
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
            video_url: base.video_url,
            gallery_image_urls: base.gallery_image_urls,
            is_free: base.is_free,
            program_draft: base.program_draft,
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
          video_url: base.video_url,
          gallery_image_urls: base.gallery_image_urls,
          is_free: base.is_free,
          program_draft: base.program_draft,
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

  async function handleHeroFileUpload(file: File) {
    setHeroUploadError("");
    setHeroUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/organizer/uploads/hero-image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        url?: string;
        error?: string;
      } | null;
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error ?? "Качването не успя.");
      }
      patchForm("heroImageUrl", payload.url);
      setThumbLoadFailed(false);
    } catch (err) {
      setHeroUploadError(err instanceof Error ? err.message : "Качването не успя.");
    } finally {
      setHeroUploadBusy(false);
      // Reset input so same file can be re-selected if needed.
      if (heroFileInputRef.current) heroFileInputRef.current.value = "";
    }
  }

  async function handleGalleryFilesUpload(files: FileList | File[]) {
    setGalleryUploadError("");
    setGalleryUploadBusy(true);
    const list = Array.from(files);
    const newUrls: string[] = [];
    try {
      for (const file of list) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/organizer/uploads/gallery-image", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          url?: string;
          error?: string;
        } | null;
        if (!res.ok || !payload?.url) {
          throw new Error(payload?.error ?? "Качването не успя.");
        }
        newUrls.push(payload.url);
      }
      if (newUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          galleryImageUrls: [...prev.galleryImageUrls, ...newUrls].slice(0, 24),
        }));
      }
    } catch (err) {
      setGalleryUploadError(err instanceof Error ? err.message : "Качването не успя.");
      // Still keep successfully uploaded ones from this batch.
      if (newUrls.length > 0) {
        setFormData((prev) => ({
          ...prev,
          galleryImageUrls: [...prev.galleryImageUrls, ...newUrls].slice(0, 24),
        }));
      }
    } finally {
      setGalleryUploadBusy(false);
      if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
    }
  }

  function removeGalleryImage(url: string) {
    setFormData((prev) => ({
      ...prev,
      galleryImageUrls: prev.galleryImageUrls.filter((u) => u !== url),
    }));
  }

  function focusHeroImageUrlField() {
    // Hero image lives on the last step (Медия и допълнително).
    setCurrentStep(LAST_STEP);
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
    setCurrentStep((s) => Math.min(LAST_STEP, s + 1));
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
    4: "Дни и събития от програмата. Помага на посетителите да запазват конкретни часове в плана си.",
    5: "Снимка, връзки към сайт и социални мрежи, тагове.",
  };

  return (
    <>
      <div ref={topAnchorRef} className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6">
        <div className="w-full max-w-2xl">
          <Link
            href="/organizer/dashboard"
            className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-black/55 transition-colors hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
          >
            <span aria-hidden="true">←</span> Назад към таблото
          </Link>

          <div className="mt-6 rounded-2xl border border-amber-200/55 bg-gradient-to-br from-amber-50/55 via-white to-white/95 p-5 shadow-sm ring-1 ring-amber-100/40 sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c2d12]">
              Ново подаване
            </p>
            <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
              Добави фестивал
            </h1>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-black/65">
              Попълни информацията стъпка по стъпка. Подаването минава преглед от
              екипа на Festivo (обикновено 24–48 часа в работни дни) преди да стане
              публично.
            </p>
          </div>
        </div>

        {loadError ? (
          <p
            role="alert"
            className="w-full max-w-2xl rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900/90"
          >
            {loadError}
          </p>
        ) : null}

        <div className={`relative ${CARD_CLASS}`}>
          {submitSuccess ? (
            <div
              className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-50/95 via-white/98 to-white/95 px-6 text-center shadow-sm ring-1 ring-emerald-200/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              <span className="text-4xl" aria-hidden="true">🎉</span>
              <p className="font-[var(--font-display)] text-lg font-bold tracking-tight text-[#0c0e14]">
                Фестивалът е изпратен успешно
              </p>
              <p className="max-w-sm text-sm text-black/65">
                Ще получиш имейл при одобрение. Пренасочваме те към подаванията…
              </p>
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
              <div className="flex flex-col gap-3 rounded-xl border border-amber-200/65 bg-amber-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#0c0e14]">
                    💾 Имаме запазена чернова
                  </p>
                  <p className="mt-0.5 text-xs text-black/60">
                    Намерихме незавършена форма от предишно посещение.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={applyPendingLocalDraft}
                    className="rounded-lg bg-[#7c2d12] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5c200d] focus:outline-none focus:ring-2 focus:ring-[#7c2d12]/25"
                  >
                    Продължи
                  </button>
                  <button
                    type="button"
                    onClick={startWizardFresh}
                    className="rounded-lg border border-black/[0.12] bg-white px-4 py-2 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.04] focus:outline-none focus:ring-2 focus:ring-black/10"
                  >
                    Започни отначало
                  </button>
                </div>
              </div>
            ) : null}

            <p className="text-[11px] text-black/45">
              <span className="text-[#7c2d12]">*</span> Задължителни полета за съответната стъпка.
              <span className="ml-1 hidden sm:inline">Формата запазва автоматично в браузъра ти.</span>
            </p>

            {error ? (
              <p
                role="alert"
                className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900/90"
              >
                {error}
              </p>
            ) : null}

            {draftId ? (
              <p className="rounded-xl border border-amber-200/65 bg-amber-50/70 px-4 py-2.5 text-xs text-[#5c200d]">
                ✏️ Работиш по чернова.{" "}
                <Link
                  className="font-semibold underline decoration-amber-700/30 underline-offset-2 hover:decoration-[#7c2d12]/60"
                  href={`/organizer/festivals/preview/${draftId}`}
                >
                  Отвори преглед
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
                <div className="space-y-5">
                  <div>
                    <label htmlFor="wizard-field-organizer" className={LABEL_TEXT_CLASS}>
                      Организатор <span className="text-[#7c2d12]">*</span>
                    </label>
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
                    {orgs.length === 0 ? (
                      <p className={HELPER_CLASS}>Зареждане на организаторите…</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="wizard-field-title" className={LABEL_TEXT_CLASS}>
                      Заглавие <span className="text-[#7c2d12]">*</span>
                    </label>
                    <input
                      id="wizard-field-title"
                      value={formData.title}
                      onChange={(ev) => patchForm("title", ev.target.value)}
                      maxLength={TITLE_MAX}
                      placeholder="Напр. Фестивал на народните танци – Враца 2026"
                      className={FIELD_CLASS}
                    />
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-black/45">
                      <span>Ясно, описателно име с място и година (ако е приложимо).</span>
                      <span className={formData.title.length > TITLE_MAX * 0.85 ? "text-amber-700" : ""}>
                        {formData.title.length}/{TITLE_MAX}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wizard-field-description" className={LABEL_TEXT_CLASS}>
                      Описание
                    </label>
                    <textarea
                      id="wizard-field-description"
                      value={formData.description}
                      onChange={(ev) => patchForm("description", ev.target.value)}
                      maxLength={DESCRIPTION_MAX}
                      rows={5}
                      placeholder="Какъв е фестивалът, за кого е, какво ще се случва — 3–5 изречения."
                      className={`${FIELD_CLASS} min-h-[7rem] resize-y`}
                    />
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-black/45">
                      <span>Хората с богато описание получават повече посещения.</span>
                      <span className={formData.description.length > DESCRIPTION_MAX * 0.85 ? "text-amber-700" : ""}>
                        {formData.description.length}/{DESCRIPTION_MAX}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="wizard-field-category" className={LABEL_TEXT_CLASS}>
                      Категория <span className="text-[#7c2d12]">*</span>
                    </label>
                    <select
                      id="wizard-field-category"
                      value={formData.category}
                      onChange={(ev) => patchForm("category", ev.target.value)}
                      className={FIELD_CLASS}
                    >
                      <option value="">— избери категория —</option>
                      {categories.map((cat) => (
                        <option key={cat.slug} value={cat.slug}>
                          {cat.label_bg}
                        </option>
                      ))}
                    </select>
                    <p className={HELPER_CLASS}>
                      Избери категорията, която най-добре описва събитието.
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStep === 2 ? (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="wizard-field-city" className={LABEL_TEXT_CLASS}>
                      Град / населено място <span className="text-[#7c2d12]">*</span>
                    </label>
                    <input
                      id="wizard-field-city"
                      value={formData.city}
                      onChange={(ev) => patchForm("city", ev.target.value)}
                      placeholder="напр. София или Пловдив"
                      className={FIELD_CLASS}
                    />
                    <p className={HELPER_CLASS}>
                      Ако е село — пиши <code className="rounded bg-amber-50 px-1 text-[10px] text-[#5c200d]">с. Боженци</code> или просто името на селото.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="wizard-field-location" className={LABEL_TEXT_CLASS}>
                      Място / локация
                    </label>
                    <input
                      id="wizard-field-location"
                      value={formData.locationName}
                      onChange={(ev) => patchForm("locationName", ev.target.value)}
                      placeholder="напр. Площад „Свобода&#8221;, парк „Възраждане&#8221;, НДК"
                      className={FIELD_CLASS}
                    />
                    <p className={HELPER_CLASS}>Името на мястото — площад, зала, парк.</p>
                  </div>

                  <div>
                    <label htmlFor="wizard-field-address" className={LABEL_TEXT_CLASS}>
                      Адрес
                    </label>
                    <input
                      id="wizard-field-address"
                      value={formData.address}
                      onChange={(ev) => patchForm("address", ev.target.value)}
                      placeholder="ул. „Витоша&#8221; 1"
                      className={FIELD_CLASS}
                    />
                    <p className={HELPER_CLASS}>
                      Улица и номер. Координатите се уточняват при модерация ако е нужно.
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200/45 bg-amber-50/35 px-4 py-3 text-xs leading-relaxed text-[#5c200d]/90">
                    💡 Точният адрес помага на хората да намерят фестивала и подобрява
                    видимостта на картата.
                  </div>
                </div>
              ) : null}

              {currentStep === 3 ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                      Дата
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="wizard-field-start-date" className={LABEL_TEXT_CLASS}>
                          Начало <span className="text-[#7c2d12]">*</span>
                        </label>
                        <input
                          id="wizard-field-start-date"
                          type="date"
                          min="2024-01-01"
                          max="2030-12-31"
                          value={formData.startDate}
                          onChange={(ev) => patchForm("startDate", ev.target.value)}
                          className={FIELD_CLASS}
                        />
                        <p className={HELPER_CLASS}>Натисни иконата 📅 за календар.</p>
                      </div>
                      <div>
                        <label htmlFor="wizard-field-end-date" className={LABEL_TEXT_CLASS}>
                          Край
                        </label>
                        <input
                          id="wizard-field-end-date"
                          type="date"
                          min="2024-01-01"
                          max="2030-12-31"
                          value={formData.endDate}
                          onChange={(ev) => patchForm("endDate", ev.target.value)}
                          className={FIELD_CLASS}
                        />
                        <p className={HELPER_CLASS}>Празно за еднодневен фестивал.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-black/[0.06] pt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/55">
                      Час (по избор)
                    </p>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="wizard-field-start-time" className={LABEL_TEXT_CLASS}>
                          Начало (час)
                        </label>
                        <input
                          id="wizard-field-start-time"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-2][0-9]:[0-5][0-9]"
                          maxLength={5}
                          placeholder="напр. 18:30"
                          value={formData.startTime}
                          onChange={(ev) => patchForm("startTime", ev.target.value)}
                          className={FIELD_CLASS}
                        />
                      </div>
                      <div>
                        <label htmlFor="wizard-field-end-time" className={LABEL_TEXT_CLASS}>
                          Край (час)
                        </label>
                        <input
                          id="wizard-field-end-time"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-2][0-9]:[0-5][0-9]"
                          maxLength={5}
                          placeholder="напр. 23:00"
                          value={formData.endTime}
                          onChange={(ev) => patchForm("endTime", ev.target.value)}
                          className={FIELD_CLASS}
                        />
                      </div>
                    </div>
                    <p className={`${HELPER_CLASS} mt-3`}>
                      Часовете подобряват точността на напомнянията към посетителите
                      (1 ден преди + 2 часа преди старт).
                    </p>
                  </div>
                </div>
              ) : null}

              {currentStep === 4 ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-amber-200/45 bg-amber-50/30 px-4 py-3 text-xs leading-relaxed text-[#5c200d]/90">
                    💡 <strong>По избор.</strong> Добави програмата с конкретни събития и
                    часове, за да могат посетителите да запазват отделни събития в
                    плана си и да получават напомняния.
                  </div>

                  <OrganizerProgramEditor
                    value={formData.programDraft}
                    onChange={(next) => patchForm("programDraft", next)}
                    defaultDate={formData.startDate}
                  />

                  <p className={HELPER_CLASS}>
                    Можеш да добавиш няколко дни и за всеки — няколко събития с
                    часове. Празни събития (без заглавие) ще бъдат игнорирани.
                  </p>
                </div>
              ) : null}

              {currentStep === 5 ? (
                <div className="space-y-7">
                  {/* Hero image — upload file OR paste URL */}
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={LABEL_TEXT_CLASS}>Основна снимка</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7c2d12]/70">
                        Препоръчително
                      </span>
                    </div>
                    <p className={HELPER_CLASS}>
                      Фестивалите със снимка получават до 3× повече посещения. Качи от
                      компютъра или постави линк.
                    </p>

                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-stretch">
                      {/* Preview tile (clickable → opens file picker) */}
                      <button
                        type="button"
                        onClick={() => heroFileInputRef.current?.click()}
                        disabled={heroUploadBusy}
                        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#fafaf8] transition-all duration-150 hover:bg-amber-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25 disabled:cursor-wait disabled:opacity-70 ${
                          hasHeroPreview
                            ? "h-36 w-full border border-amber-200/55 sm:h-auto sm:w-44 sm:min-h-[9rem]"
                            : "h-36 w-full border-2 border-dashed border-amber-300/60 sm:w-44"
                        }`}
                        aria-label="Качи снимка"
                      >
                        {heroUploadBusy ? (
                          <span className="flex flex-col items-center gap-1 px-3 text-center">
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#7c2d12]/30 border-t-[#7c2d12]" />
                            <span className="text-xs font-semibold text-[#7c2d12]">Качване…</span>
                          </span>
                        ) : hasHeroPreview ? (
                          // eslint-disable-next-line @next/next/no-img-element -- arbitrary URL paste (no remotePatterns guarantee)
                          <img
                            src={trimmedHeroImageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={() => setThumbLoadFailed(true)}
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-1 px-3 text-center">
                            <span className="text-2xl" aria-hidden="true">📷</span>
                            <span className="text-xs font-semibold text-[#7c2d12]">+ Качи снимка</span>
                          </span>
                        )}
                      </button>

                      {/* Hidden file input — triggered by tile click OR upload button */}
                      <input
                        ref={heroFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        className="sr-only"
                        onChange={(ev) => {
                          const file = ev.target.files?.[0];
                          if (file) void handleHeroFileUpload(file);
                        }}
                      />

                      <div className="block min-w-0 flex-1 space-y-2.5">
                        <p className="text-xs text-black/55">
                          Натисни <strong>квадратчето вляво</strong> за да качиш снимка
                          от компютъра си, или постави линк по-долу.
                        </p>

                        <div>
                          <label htmlFor="wizard-field-hero" className={LABEL_TEXT_CLASS}>
                            Линк към снимка
                          </label>
                          <input
                            id="wizard-field-hero"
                            ref={heroImageUrlInputRef}
                            value={formData.heroImageUrl}
                            onChange={(ev) => patchForm("heroImageUrl", ev.target.value)}
                            type="url"
                            placeholder="https://…/poster.jpg"
                            className={FIELD_CLASS}
                            disabled={heroUploadBusy}
                          />
                        </div>

                        {formData.heroImageUrl.trim() ? (
                          <button
                            type="button"
                            onClick={() => {
                              patchForm("heroImageUrl", "");
                              setThumbLoadFailed(false);
                            }}
                            className="text-[11px] font-medium text-red-700 underline decoration-red-300/40 underline-offset-2 hover:decoration-red-500/60"
                          >
                            Премахни снимката
                          </button>
                        ) : null}

                        <p className={HELPER_CLASS}>
                          Формати: .jpg, .png, .webp, .gif. Максимум 8 MB.
                        </p>
                        {heroUploadError ? (
                          <p className="text-[11px] text-red-700" role="alert">
                            ⚠️ {heroUploadError}
                          </p>
                        ) : null}
                        {thumbLoadFailed && trimmedHeroImageUrl ? (
                          <p className="text-[11px] text-red-700">
                            ⚠️ Снимката не може да се зареди. Провери линка.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Gallery — multiple files */}
                  <div className="border-t border-black/[0.06] pt-6">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={LABEL_TEXT_CLASS}>Галерия (по избор)</span>
                      <span className="text-[10px] text-black/45">
                        {formData.galleryImageUrls.length}/24
                      </span>
                    </div>
                    <p className={HELPER_CLASS}>
                      Допълнителни снимки от фестивала. Може да качиш няколко наведнъж.
                    </p>

                    {formData.galleryImageUrls.length > 0 ? (
                      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {formData.galleryImageUrls.map((url) => (
                          <div
                            key={url}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-amber-200/55 bg-[#fafaf8]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary URL */}
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(url)}
                              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-xs font-bold text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                              aria-label="Премахни снимка"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <input
                      ref={galleryFileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                      className="sr-only"
                      onChange={(ev) => {
                        const files = ev.target.files;
                        if (files && files.length > 0) void handleGalleryFilesUpload(files);
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => galleryFileInputRef.current?.click()}
                      disabled={galleryUploadBusy || formData.galleryImageUrls.length >= 24}
                      className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-300/60 bg-amber-50/30 px-4 py-2 text-sm font-semibold text-[#7c2d12] transition hover:bg-amber-50/60 disabled:cursor-wait disabled:opacity-60"
                    >
                      {galleryUploadBusy ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#7c2d12]/30 border-t-[#7c2d12]" />
                          Качване…
                        </>
                      ) : (
                        <>📤 Качи снимки</>
                      )}
                    </button>

                    {galleryUploadError ? (
                      <p className="mt-2 text-[11px] text-red-700" role="alert">
                        ⚠️ {galleryUploadError}
                      </p>
                    ) : null}
                  </div>

                  {/* Video URL */}
                  <div className="border-t border-black/[0.06] pt-6">
                    <label htmlFor="wizard-field-video" className={LABEL_TEXT_CLASS}>
                      🎬 Видео (по избор)
                    </label>
                    <input
                      id="wizard-field-video"
                      value={formData.videoUrl}
                      onChange={(ev) => patchForm("videoUrl", ev.target.value)}
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=…"
                      className={FIELD_CLASS}
                    />
                    <p className={HELPER_CLASS}>
                      YouTube или Facebook линк. Видеата се вграждат в страницата на
                      фестивала.
                    </p>
                  </div>

                  {/* Links */}
                  <div className="space-y-5 border-t border-black/[0.06] pt-6">
                    <div>
                      <h3 className="text-sm font-semibold text-[#0c0e14]">Връзки</h3>
                      <p className={HELPER_CLASS}>
                        Всички по избор. Помагат на посетителите да научат повече.
                      </p>
                    </div>

                    <div>
                      <label htmlFor="wizard-field-website" className={LABEL_TEXT_CLASS}>
                        🔗 Уебсайт
                      </label>
                      <input
                        id="wizard-field-website"
                        value={formData.websiteUrl}
                        onChange={(ev) => patchForm("websiteUrl", ev.target.value)}
                        type="url"
                        placeholder="https://"
                        className={FIELD_CLASS}
                      />
                    </div>

                    <div>
                      <label htmlFor="wizard-field-facebook" className={LABEL_TEXT_CLASS}>
                        📘 Facebook
                      </label>
                      <input
                        id="wizard-field-facebook"
                        value={formData.facebookUrl}
                        onChange={(ev) => patchForm("facebookUrl", ev.target.value)}
                        type="url"
                        placeholder="https://facebook.com/…"
                        className={FIELD_CLASS}
                      />
                    </div>

                    <div>
                      <label htmlFor="wizard-field-instagram" className={LABEL_TEXT_CLASS}>
                        📸 Instagram
                      </label>
                      <input
                        id="wizard-field-instagram"
                        value={formData.instagramUrl}
                        onChange={(ev) => patchForm("instagramUrl", ev.target.value)}
                        type="url"
                        placeholder="https://instagram.com/…"
                        className={FIELD_CLASS}
                      />
                    </div>

                  </div>

                  {/* Билети + безплатно */}
                  <div className="space-y-4 border-t border-black/[0.06] pt-6">
                    <h3 className="text-sm font-semibold text-[#0c0e14]">🎟️ Билети</h3>

                    {/* Free checkbox first — controls whether ticket URL is editable */}
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200/55 bg-emerald-50/30 px-4 py-3 transition hover:bg-emerald-50/55">
                      <input
                        type="checkbox"
                        checked={formData.isFree}
                        onChange={(ev) => {
                          const next = ev.target.checked;
                          patchForm("isFree", next);
                          // Когато потребителят избере 'безплатно', изчистваме евентуален
                          // ticket URL — иначе той ще се запази в DB докато полето е disabled.
                          if (next && formData.ticketUrl.trim()) {
                            patchForm("ticketUrl", "");
                          }
                        }}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-emerald-300 accent-emerald-700 focus:ring-2 focus:ring-emerald-500/30"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[#0c0e14]">
                          Безплатно събитие
                        </span>
                        <span className="mt-0.5 block text-[11px] text-black/55">
                          Маркирай ако входът е свободен. Премахни отметката, ако
                          събитието е платено — тогава ще можеш да добавиш линк за билети.
                        </span>
                      </span>
                    </label>

                    {/* Ticket URL — disabled when free */}
                    <div>
                      <label
                        htmlFor="wizard-field-ticket"
                        className={`${LABEL_TEXT_CLASS} ${formData.isFree ? "text-black/35" : ""}`}
                      >
                        Линк за билети
                      </label>
                      <input
                        id="wizard-field-ticket"
                        value={formData.ticketUrl}
                        onChange={(ev) => patchForm("ticketUrl", ev.target.value)}
                        type="url"
                        placeholder={formData.isFree ? "—" : "https://…"}
                        disabled={formData.isFree}
                        className={`${FIELD_CLASS} disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/35`}
                      />
                      <p className={HELPER_CLASS}>
                        {formData.isFree
                          ? "Не е приложимо за безплатни събития."
                          : "Сайт за билети, eventim, ticketportal или собствен линк."}
                      </p>
                    </div>
                  </div>

                  {/* Тагове */}
                  <div className="border-t border-black/[0.06] pt-6">
                    <label htmlFor="wizard-field-tags" className={LABEL_TEXT_CLASS}>
                      Тагове
                    </label>
                    <input
                      id="wizard-field-tags"
                      value={formData.tagsInput}
                      onChange={(ev) => patchForm("tagsInput", ev.target.value)}
                      placeholder="фолклор, музика, винен, семейство"
                      className={FIELD_CLASS}
                    />
                    <p className={HELPER_CLASS}>
                      Отделени със запетая. Помагат на хората да открият фестивала по тема.
                    </p>
                  </div>
                </div>
              ) : null}
            </StepContainer>

            <StepNavigation
              showBack={currentStep > 1}
              isLastStep={currentStep === LAST_STEP}
              busy={busy}
              disableNext={!isStepValid(currentStep, formData)}
              disableSubmit={busy || !orgs.length || !canSubmitFestival(formData)}
              onBack={goBack}
              onNext={goNext}
              onSubmit={requestFinalSubmit}
              submitPrepSlot={
                currentStep === LAST_STEP ? (
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
                currentStep === LAST_STEP ? (
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-festival-image-prompt-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-200/60 bg-white p-6 shadow-xl ring-1 ring-amber-100/40">
            <div className="flex items-start gap-4">
              <span className="text-3xl" aria-hidden="true">📷</span>
              <div className="min-w-0 flex-1">
                <h2
                  id="new-festival-image-prompt-title"
                  className="font-[var(--font-display)] text-lg font-bold text-[#0c0e14]"
                >
                  Добави снимка?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-black/65">
                  Фестивалите със снимка получават до{" "}
                  <strong className="text-[#7c2d12]">3× повече</strong> посещения.
                  Сигурен ли си че искаш да продължиш без?
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                className="w-full rounded-xl border border-black/[0.12] bg-white px-4 py-2.5 text-sm font-semibold text-[#0c0e14] transition hover:bg-black/[0.04] sm:w-auto"
                onClick={() => {
                  setImageMissingModalOpen(false);
                  void performSubmit({ forceEmptyHero: true });
                }}
              >
                Продължи без
              </button>
              <button
                type="button"
                className="w-full rounded-xl bg-[#7c2d12] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5c200d] sm:w-auto"
                onClick={() => {
                  setImageMissingModalOpen(false);
                  focusHeroImageUrlField();
                }}
              >
                Добави снимка →
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
  categories = [],
}: {
  initialDraft?: NewFestivalDraftInitial | null;
  categories?: FestivalCategory[];
}) {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-black/55">Зареждане…</div>}>
      <NewFestivalSubmissionInner initialDraft={initialDraft} categories={categories} />
    </Suspense>
  );
}
