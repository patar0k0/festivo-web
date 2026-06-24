"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import OrganizerProfileLogo from "@/components/organizers/OrganizerProfileLogo";
import { useDebouncedSave } from "@/lib/hooks/useDebouncedSave";
import { useDirtyState } from "@/lib/hooks/useDirtyState";
import { normalizeExternalHttpHref } from "@/lib/urls/externalHref";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

const UNSAVED_NAV_CONFIRM = "Имате незапазени промени. Искате ли да напуснете без да запазите?";

const AUTOSAVE_DEBOUNCE_MS = 1000;

const SAVED_STATUS_HIDE_MS = 2500;

const SUBMIT_ERROR_FALLBACK = "Грешка при запис. Опитай отново.";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type PatchSnapshot = {
  name: string;
  description: string;
  logo_url: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  email: string;
  phone: string;
  city_id: number | null;
  city_name: string | null;
};

/** Same-window internal navigation away from the current URL (needs unsaved guard). */
function anchorClickWouldLeavePage(a: HTMLAnchorElement): boolean {
  if (a.download) return false;
  const targetAttr = (a.getAttribute("target") ?? "").trim().toLowerCase();
  if (targetAttr === "_blank" || a.target === "_blank") return false;

  const hrefAttr = a.getAttribute("href");
  if (!hrefAttr || hrefAttr === "#" || hrefAttr.startsWith("#")) return false;
  if (hrefAttr.startsWith("javascript:")) return false;
  if (hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) return false;
  try {
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    const cur = new URL(window.location.href);
    if (url.pathname === cur.pathname && url.search === cur.search && url.hash === cur.hash) return false;
    return true;
  } catch {
    return false;
  }
}

/** Trim and add https:// when no scheme so stored URLs are absolute. */
function normalizeUrl(url: string): string {
  const t = url.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  return `https://${t}`;
}

export type OrganizerCityOption = { id: number; name_bg: string };

type CitySuggestionApi = { id: number; name_bg: string; slug: string; is_village: boolean | null };

type OrganizerProfileEditFormProps = {
  organizerId: string;
  /** Public profile path segment: `/organizers/{slug}` */
  publicProfileSlug: string;
  initialCity: OrganizerCityOption | null;
  initial: {
    name: string;
    description: string;
    logo_url: string;
    website_url: string;
    facebook_url: string;
    instagram_url: string;
    email: string;
    phone: string;
    verified: boolean;
    city_id: number | null;
  };
};

/** Canonical shape for dirty checks and last-saved baseline (trimmed strings, no undefined). */
function normalizeFormData(f: {
  name: string;
  description: string;
  logo_url: string;
  website_url: string;
  facebook_url: string;
  instagram_url: string;
  email: string;
  phone: string;
  city_id: number | null;
  city_name: string | null;
}): PatchSnapshot {
  const websiteNorm = normalizeUrl(f.website_url.trim());
  const fbRaw = f.facebook_url.trim();
  const igRaw = f.instagram_url.trim();
  const facebookNorm = fbRaw ? normalizeUrl(fbRaw) : "";
  const instagramNorm = igRaw ? normalizeUrl(igRaw) : "";
  return {
    name: f.name.trim(),
    description: f.description,
    logo_url: (f.logo_url ?? "").trim(),
    website_url: websiteNorm,
    facebook_url: facebookNorm,
    instagram_url: instagramNorm,
    email: f.email.trim(),
    phone: f.phone.trim(),
    city_id: f.city_id ?? null,
    city_name: f.city_name ?? null,
  };
}

function initialPatchSnapshot(initial: OrganizerProfileEditFormProps["initial"]): PatchSnapshot {
  return normalizeFormData({
    name: initial.name,
    description: initial.description,
    logo_url: initial.logo_url || "",
    website_url: initial.website_url,
    facebook_url: initial.facebook_url,
    instagram_url: initial.instagram_url,
    email: initial.email,
    phone: initial.phone,
    city_id: initial.city_id,
    city_name: null,
  });
}

function getFieldErrors(s: PatchSnapshot): Record<string, string> {
  const err: Record<string, string> = {};
  if (!s.name.trim()) {
    err.name = "Това поле е задължително";
  }
  if (s.email && !isValidEmailLoose(s.email)) {
    err.email = "Невалиден имейл";
  }
  if (s.website_url && !isValidUrl(s.website_url)) {
    err.website_url = "Невалиден URL";
  }
  if (s.facebook_url && !isValidUrl(s.facebook_url)) {
    err.facebook_url = "Невалиден URL";
  }
  if (s.instagram_url && !isValidUrl(s.instagram_url)) {
    err.instagram_url = "Невалиден URL";
  }
  return err;
}

function organizerInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  const single = parts[0] ?? name;
  return single.slice(0, 2).toUpperCase();
}

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : `tel:${phone.trim()}`;
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 16h-8.5A2.25 2.25 0 0 1 2 13.75v-8.5A2.25 2.25 0 0 1 4.25 3h4a.75.75 0 0 1 0 1.5h-4Z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M6.194 13.915a.75.75 0 0 0 1.06.053l7.25-6.5a.75.75 0 0 0-1-1.12l-7.25 6.5a.75.75 0 0 0-.053 1.06ZM16.78 3.22a.75.75 0 1 0-1.06 1.06L9.47 10.53l1.06 1.06 6.25-6.25a.75.75 0 0 0 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function isValidUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidEmailLoose(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function SavedAgoText({ savedAt }: { savedAt: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [savedAt]);
  const sec = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
  return <>Запазено преди {sec} сек.</>;
}

function FormSection({
  title,
  description,
  children,
  isPrimary,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  isPrimary?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2
          className={cn(
            "font-[var(--font-display)] tracking-tight text-[#0c0e14]",
            isPrimary ? "text-lg font-bold md:text-xl" : "text-base font-semibold",
          )}
        >
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-black/55">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

type TouchedFieldKey =
  | "name"
  | "description"
  | "email"
  | "phone"
  | "website_url"
  | "facebook_url"
  | "instagram_url"
  | "logo_url"
  | "city_id";

function inputClass(invalid: boolean, validHighlight?: boolean) {
  return cn(
    "mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:border-black",
    invalid && "border-red-300 text-red-600 focus:border-red-400",
    !invalid && validHighlight && "border-green-300",
    !invalid && !validHighlight && "border-black/[0.16]",
  );
}

export default function OrganizerProfileEditForm({
  organizerId,
  publicProfileSlug,
  initialCity,
  initial,
}: OrganizerProfileEditFormProps) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description,
    logo_url: initial.logo_url || "",
    website_url: initial.website_url,
    facebook_url: initial.facebook_url,
    instagram_url: initial.instagram_url,
    email: initial.email,
    phone: initial.phone,
    city_id: initial.city_id,
    city_name: null as string | null,
  });
  const { setLastSaved, checkDirty } = useDirtyState(initialPatchSnapshot(initial));
  const [verifiedPreview, setVerifiedPreview] = useState(initial.verified);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [localLogoObjectUrl, setLocalLogoObjectUrl] = useState<string | null>(null);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<TouchedFieldKey, true>>>({});

  const [cityQuery, setCityQuery] = useState(initialCity?.name_bg ?? "");
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestionApi[]>([]);
  const [cityHasExactMatch, setCityHasExactMatch] = useState(false);
  const [cityBusy, setCityBusy] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;
  const inFlightRef = useRef(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const snapshot = useMemo(() => normalizeFormData(form), [form]);
  const dirty = checkDirty(snapshot);
  const fieldErrors = useMemo(() => getFieldErrors(snapshot), [snapshot]);
  const isValid = Object.keys(fieldErrors).length === 0;

  const previewLogoUrl = (localLogoObjectUrl ?? form.logo_url.trim()) || null;
  const previewInitials = organizerInitialsFromName(form.name);
  const previewWebsiteHref = normalizeExternalHttpHref(form.website_url);
  const previewFacebookHref = normalizeExternalHttpHref(form.facebook_url);
  const previewInstagramHref = normalizeExternalHttpHref(form.instagram_url);
  const hasSocialOrWeb = Boolean(previewWebsiteHref || previewFacebookHref || previewInstagramHref);
  const previewEmail = form.email.trim() || null;
  const previewPhone = form.phone.trim() || null;
  const previewCityName =
    form.city_name?.trim() ||
    (form.city_id != null && initialCity?.id === form.city_id ? initialCity?.name_bg : null) ||
    citySuggestions.find((c) => c.id === form.city_id)?.name_bg ||
    null;
  const previewCityLabel =
    previewCityName ?? (form.city_id == null ? "Без избран град" : "Град не е наличен");
  const previewCityIsFallback = previewCityName === null;

  const executePatch = useCallback(async (): Promise<boolean> => {
    const f = formRef.current;
    const snap = normalizeFormData(f);
    if (Object.keys(getFieldErrors(snap)).length > 0) {
      return false;
    }
    if (inFlightRef.current) {
      return false;
    }

    const payload = {
      name: snap.name,
      description: snap.description,
      logo_url: snap.logo_url,
      website_url: snap.website_url,
      facebook_url: snap.facebook_url,
      instagram_url: snap.instagram_url,
      email: snap.email,
      phone: snap.phone,
      city_id: snap.city_id,
      city_name: snap.city_name,
    };

    inFlightRef.current = true;
    setSaveStatus("saving");
    setApiError(null);

    try {
      const response = await fetch(`/api/organizers/${organizerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        verified?: boolean;
        city_id?: number | null;
        error?: string;
      };

      if (!response.ok) {
        setSaveStatus("error");
        setApiError(typeof body.error === "string" ? body.error : SUBMIT_ERROR_FALLBACK);
        return false;
      }

      if (typeof body.verified === "boolean") {
        setVerifiedPreview(body.verified);
      }

      const reconciled =
        snap.city_name && typeof body.city_id === "number"
          ? { ...snap, city_id: body.city_id, city_name: null }
          : snap;
      if (reconciled !== snap) {
        setForm((f) => ({ ...f, city_id: body.city_id ?? f.city_id, city_name: null }));
        setCityQuery((prev) => prev); // запазваме показаното име
      }

      setLastSaved(reconciled);
      setSaveStatus("saved");
      setLastSavedAt(Date.now());

      return true;
    } catch {
      setSaveStatus("error");
      setApiError(SUBMIT_ERROR_FALLBACK);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [organizerId, setLastSaved]);

  const { schedule, cancel } = useDebouncedSave({
    delayMs: AUTOSAVE_DEBOUNCE_MS,
    onSave: async () => {
      const f = formRef.current;
      const snap = normalizeFormData(f);
      if (!checkDirty(snap)) {
        return true;
      }
      if (Object.keys(getFieldErrors(snap)).length > 0) {
        return true;
      }
      return executePatch();
    },
  });

  const tryConfirmUnsavedNavigation = useCallback((): boolean => {
    if (confirmRef.current) return false;
    confirmRef.current = true;
    try {
      return confirm(UNSAVED_NAV_CONFIRM);
    } finally {
      confirmRef.current = false;
    }
  }, []);

  const handleNavigation = useCallback(
    (e: ReactMouseEvent) => {
      if (!dirty || saveStatus === "saving") return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const a = target.closest("a");
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      if (!anchorClickWouldLeavePage(a)) return;

      const ok = tryConfirmUnsavedNavigation();
      if (!ok) e.preventDefault();
    },
    [dirty, saveStatus, tryConfirmUnsavedNavigation],
  );

  const markTouched = useCallback((key: TouchedFieldKey) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  useEffect(() => {
    if (!dirty || !isValid) {
      return () => cancel();
    }
    schedule();
    return () => cancel();
  }, [snapshot, dirty, isValid, schedule, cancel]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = window.setTimeout(() => {
      setSaveStatus("idle");
    }, SAVED_STATUS_HIDE_MS);
    return () => window.clearTimeout(t);
  }, [saveStatus]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty || saveStatus === "saving") return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, saveStatus]);

  useEffect(() => {
    return () => {
      if (localLogoObjectUrl) {
        URL.revokeObjectURL(localLogoObjectUrl);
      }
    };
  }, [localLogoObjectUrl]);

  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    const q = cityQuery.trim();

    // Picked existing city whose name matches the field → nothing to search.
    if (form.city_id != null && q === (initialCity?.id === form.city_id ? initialCity?.name_bg.trim() : q)) {
      // fall through; handled below by clearing suggestions when query unchanged
    }

    if (!q) {
      setCitySuggestions([]);
      setCityHasExactMatch(false);
      setCityBusy(false);
      return;
    }

    setCityBusy(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json().catch(() => ({}))) as {
          suggestions?: CitySuggestionApi[];
          hasExactMatch?: boolean;
        };
        setCitySuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setCityHasExactMatch(Boolean(data.hasExactMatch));
      } catch {
        setCitySuggestions([]);
        setCityHasExactMatch(false);
      } finally {
        setCityBusy(false);
      }
    }, 250);

    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    };
  }, [cityQuery, form.city_id, initialCity]);

  useEffect(() => {
    if (!dirty || saveStatus === "saving") return;

    function onDocumentClickCapture(e: globalThis.MouseEvent) {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (rootRef.current?.contains(e.target as Node)) return;

      const target = e.target as HTMLElement | null;
      const a = target?.closest?.("a");
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      if (!anchorClickWouldLeavePage(a)) return;

      const ok = tryConfirmUnsavedNavigation();
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    document.addEventListener("click", onDocumentClickCapture, true);
    return () => document.removeEventListener("click", onDocumentClickCapture, true);
  }, [dirty, saveStatus, tryConfirmUnsavedNavigation]);

  function handleFieldChange(key?: TouchedFieldKey) {
    if (key) markTouched(key);
    setApiError(null);
    if (saveStatus === "saved") {
      setSaveStatus("idle");
      setLastSavedAt(null);
    }
  }

  function handleWebsiteBlur() {
    markTouched("website_url");
    const normalized = normalizeUrl(form.website_url.trim());
    if (normalized === form.website_url) return;
    setForm((f) => ({ ...f, website_url: normalized }));
    setApiError(null);
    if (saveStatus === "saved") {
      setSaveStatus("idle");
      setLastSavedAt(null);
    }
  }

  function handleSocialBlur(field: "facebook_url" | "instagram_url") {
    markTouched(field);
    const raw = form[field].trim();
    if (!raw) return;
    const normalized = normalizeUrl(raw);
    if (normalized === form[field]) return;
    setForm((f) => ({ ...f, [field]: normalized }));
    setApiError(null);
    if (saveStatus === "saved") {
      setSaveStatus("idle");
      setLastSavedAt(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cancel();

    const f = formRef.current;
    const snap = normalizeFormData(f);
    if (Object.keys(getFieldErrors(snap)).length > 0) {
      setApiError(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    await executePatch();
    if (checkDirty(normalizeFormData(formRef.current))) {
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function revokeLocalLogo() {
    if (localLogoObjectUrl) {
      URL.revokeObjectURL(localLogoObjectUrl);
      setLocalLogoObjectUrl(null);
    }
  }

  async function processLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setApiError("Файлът трябва да е изображение");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setApiError("Максимален размер 2MB");
      return;
    }

    revokeLocalLogo();
    const url = URL.createObjectURL(file);
    setLocalLogoObjectUrl(url);

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingLogo(true);
    setApiError(null);
    try {
      const res = await fetch(`/api/organizers/${organizerId}/logo`, {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        revokeLocalLogo();
        setApiError(data.error ?? "Грешка при качване на лого");
        return;
      }

      setForm((prev) => ({
        ...prev,
        logo_url: data.url!,
      }));
      revokeLocalLogo();
    } catch {
      revokeLocalLogo();
      setApiError("Грешка при качване на лого");
    } finally {
      setIsUploadingLogo(false);
    }
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await processLogoFile(file);
  }

  function onLogoDrop(e: DragEvent) {
    e.preventDefault();
    setIsDraggingLogo(false);
    if (isUploadingLogo) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processLogoFile(file);
  }

  const saving = saveStatus === "saving";

  const saveStatusRow = (
    <div className="min-h-[1.25rem] text-xs" aria-live="polite">
      {saveStatus === "idle" && apiError ? <span className="text-red-600">{apiError}</span> : null}
      {saveStatus === "saving" ? <span className="text-black/50">Запазване...</span> : null}
      {saveStatus === "saved" && lastSavedAt ? (
        <span className="text-black/50">
          <SavedAgoText savedAt={lastSavedAt} />
        </span>
      ) : null}
      {saveStatus === "error" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-red-600">{apiError ?? "Грешка при запазване"}</span>
          <button
            type="button"
            onClick={() => {
              void executePatch();
            }}
            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
          >
            Опитай отново
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(280px,380px)] lg:items-start"
      onClickCapture={handleNavigation}
    >
      <form onSubmit={onSubmit} className="flex flex-col rounded-2xl border border-black/[0.08] bg-white/90 shadow-sm md:pb-0">
        <div className="space-y-0 px-6 pb-6 pt-6 md:px-8 md:pt-8">
          <div className="flex flex-col gap-6">
            <FormSection
              isPrimary
              title="Основна информация"
              description="Име, описание и лого — това виждат първо в публичния профил."
            >
              <div>
                <label htmlFor="name" className={pub.label}>
                  Име
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => {
                    handleFieldChange("name");
                    setForm((f) => ({ ...f, name: e.target.value }));
                  }}
                  className={inputClass(Boolean(fieldErrors.name), Boolean(touched.name) && !fieldErrors.name)}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? "name-error" : undefined}
                />
                {fieldErrors.name ? (
                  <p id="name-error" className="mt-1 text-sm text-red-600">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="description" className={pub.label}>
                  Описание
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={5}
                  value={form.description}
                  onChange={(e) => {
                    handleFieldChange("description");
                    setForm((f) => ({ ...f, description: e.target.value }));
                  }}
                  className={inputClass(
                    false,
                    Boolean(touched.description) && form.description.trim().length > 0,
                  )}
                />
              </div>

              <div>
                <span className={pub.label}>Лого</span>
                <div
                  className={cn(
                    "mt-2 space-y-3 rounded-xl border border-dashed p-4 transition",
                    isDraggingLogo ? "border-black/35 bg-black/[0.03]" : "border-gray-200 bg-white/80",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingLogo(true);
                  }}
                  onDragLeave={() => setIsDraggingLogo(false)}
                  onDrop={onLogoDrop}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-black/[0.16] bg-white px-4 py-2 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUploadingLogo ? "Качване..." : "Качи лого"}
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="sr-only"
                      disabled={isUploadingLogo}
                    />
                    {previewLogoUrl ? (
                      <>
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={isUploadingLogo}
                          className="text-sm text-black/55 underline-offset-2 hover:text-black hover:underline"
                        >
                          Смени логото
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            handleFieldChange("logo_url");
                            revokeLocalLogo();
                            setForm((f) => ({ ...f, logo_url: "" }));
                          }}
                          className="text-sm text-red-600/90 underline-offset-2 hover:underline"
                        >
                          Премахни логото
                        </button>
                      </>
                    ) : null}
                  </div>
                  <p className="text-xs text-black/45">Пусни файл тук или използвай бутона. Макс. 2MB.</p>
                  <div>
                    <label htmlFor="logo_url" className="sr-only">
                      URL на лого
                    </label>
                    <input
                      id="logo_url"
                      name="logo_url"
                      type="url"
                      placeholder="https://... (по избор)"
                      value={form.logo_url}
                      onChange={(e) => {
                        handleFieldChange("logo_url");
                        revokeLocalLogo();
                        setForm((f) => ({ ...f, logo_url: e.target.value }));
                      }}
                      className={inputClass(false)}
                    />
                  </div>
                  {previewLogoUrl ? (
                    <Image
                      src={previewLogoUrl}
                      alt="Преглед на лого"
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 rounded-lg border border-black/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-black/20 bg-white text-xs text-black/40">
                      Лого
                    </div>
                  )}
                </div>
              </div>
            </FormSection>

            <div className="border-t border-gray-200 pt-6">
              <FormSection
                title="Контакт"
                description="Имейл, телефон и официален сайт. Показват се в публичния профил."
              >
                <div>
                  <label htmlFor="email" className={pub.label}>
                    Имейл
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => {
                      handleFieldChange("email");
                      setForm((f) => ({ ...f, email: e.target.value }));
                    }}
                    className={inputClass(Boolean(fieldErrors.email), Boolean(touched.email) && !fieldErrors.email)}
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  />
                  {fieldErrors.email ? (
                    <p id="email-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.email}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="phone" className={pub.label}>
                    Телефон
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => {
                      handleFieldChange("phone");
                      setForm((f) => ({ ...f, phone: e.target.value }));
                    }}
                    className={inputClass(false)}
                  />
                </div>
                <div>
                  <label htmlFor="website" className={pub.label}>
                    Уебсайт
                  </label>
                  <input
                    id="website"
                    name="website"
                    type="url"
                    value={form.website_url}
                    onChange={(e) => {
                      handleFieldChange("website_url");
                      setForm((f) => ({ ...f, website_url: e.target.value }));
                    }}
                    onBlur={handleWebsiteBlur}
                    className={inputClass(
                      Boolean(fieldErrors.website_url),
                      Boolean(touched.website_url) && !fieldErrors.website_url,
                    )}
                    aria-invalid={fieldErrors.website_url ? true : undefined}
                    aria-describedby={fieldErrors.website_url ? "website-error" : undefined}
                  />
                  {fieldErrors.website_url ? (
                    <p id="website-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.website_url}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-black/45">Можеш да въведеш домейн без https (напр. example.bg)</p>
                </div>
              </FormSection>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <FormSection title="Социални мрежи" description="Връзки към Facebook и Instagram.">
                <div>
                  <label htmlFor="facebook" className={pub.label}>
                    Facebook
                  </label>
                  <input
                    id="facebook"
                    name="facebook"
                    type="url"
                    value={form.facebook_url}
                    onChange={(e) => {
                      handleFieldChange("facebook_url");
                      setForm((f) => ({ ...f, facebook_url: e.target.value }));
                    }}
                    onBlur={() => handleSocialBlur("facebook_url")}
                    className={inputClass(
                      Boolean(fieldErrors.facebook_url),
                      Boolean(touched.facebook_url) && !fieldErrors.facebook_url,
                    )}
                    aria-invalid={fieldErrors.facebook_url ? true : undefined}
                    aria-describedby={fieldErrors.facebook_url ? "facebook-error" : undefined}
                  />
                  {fieldErrors.facebook_url ? (
                    <p id="facebook-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.facebook_url}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="instagram" className={pub.label}>
                    Instagram
                  </label>
                  <input
                    id="instagram"
                    name="instagram"
                    type="url"
                    value={form.instagram_url}
                    onChange={(e) => {
                      handleFieldChange("instagram_url");
                      setForm((f) => ({ ...f, instagram_url: e.target.value }));
                    }}
                    onBlur={() => handleSocialBlur("instagram_url")}
                    className={inputClass(
                      Boolean(fieldErrors.instagram_url),
                      Boolean(touched.instagram_url) && !fieldErrors.instagram_url,
                    )}
                    aria-invalid={fieldErrors.instagram_url ? true : undefined}
                    aria-describedby={fieldErrors.instagram_url ? "instagram-error" : undefined}
                  />
                  {fieldErrors.instagram_url ? (
                    <p id="instagram-error" className="mt-1 text-sm text-red-600">
                      {fieldErrors.instagram_url}
                    </p>
                  ) : null}
                </div>
              </FormSection>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <FormSection
                title="Локация"
                description="Основен град на организатора — показва се в публичния профил, когато е зададен."
              >
                <div className="relative">
                  <label htmlFor="city_query" className={pub.label}>
                    Град
                  </label>
                  <input
                    id="city_query"
                    name="city_query"
                    type="text"
                    autoComplete="off"
                    placeholder="Започни да пишеш населено място…"
                    value={cityQuery}
                    onChange={(e) => {
                      handleFieldChange("city_id");
                      const v = e.target.value;
                      setCityQuery(v);
                      // Editing the text invalidates any picked/created city until re-selected.
                      setForm((f) => ({ ...f, city_id: null, city_name: null }));
                    }}
                    className={inputClass(false)}
                  />
                  {cityBusy ? <p className="mt-1 text-xs text-black/45">Търсене…</p> : null}

                  {form.city_id != null || form.city_name ? (
                    <p className="mt-1 flex items-center gap-2 text-xs font-medium text-[#1f7a37]">
                      Избрано: {form.city_name?.trim() || cityQuery.trim()}
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange("city_id");
                          setForm((f) => ({ ...f, city_id: null, city_name: null }));
                          setCityQuery("");
                          setCitySuggestions([]);
                          setCityHasExactMatch(false);
                        }}
                        className="text-black/45 underline-offset-2 hover:text-black hover:underline"
                      >
                        Изчисти
                      </button>
                    </p>
                  ) : null}

                  {(citySuggestions.length > 0 || (cityQuery.trim() && !cityHasExactMatch && !cityBusy)) &&
                  form.city_id == null &&
                  !form.city_name ? (
                    <ul className="mt-2 divide-y divide-black/[0.06] overflow-hidden rounded-lg border border-black/[0.12] bg-white">
                      {citySuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange("city_id");
                              setForm((f) => ({ ...f, city_id: c.id, city_name: null }));
                              setCityQuery(c.name_bg);
                              setCitySuggestions([]);
                              setCityHasExactMatch(true);
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-black/[0.03]"
                          >
                            {c.name_bg}
                          </button>
                        </li>
                      ))}
                      {cityQuery.trim() && !cityHasExactMatch ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange("city_id");
                              const name = cityQuery.trim();
                              setForm((f) => ({ ...f, city_id: null, city_name: name }));
                              setCitySuggestions([]);
                            }}
                            className="flex w-full items-center px-3 py-2 text-left text-sm font-medium text-[#7c2d12] hover:bg-amber-50/60"
                          >
                            ➕ Добави „{cityQuery.trim()}“
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              </FormSection>
            </div>
          </div>

          {apiError && saveStatus === "error" ? (
            <div className="mt-6" role="alert" aria-live="assertive">
              <p className="text-sm text-red-600">{apiError}</p>
            </div>
          ) : null}

          {dirty ? (
            <p className="mt-6 text-xs font-medium text-amber-900/85">Имате незапазени промени</p>
          ) : (
            <p className="mt-6 text-xs text-black/45">Няма незапазени промени</p>
          )}
        </div>

        <div className="sticky bottom-0 z-10 mt-auto border-t border-gray-200 bg-white/95 px-6 py-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-md md:px-8">
          {saveStatusRow}
          <button
            type="submit"
            disabled={saving || !dirty}
            aria-busy={saving}
            className={cn(
              "mt-2 w-full rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed",
              saving || !dirty ? "cursor-not-allowed bg-gray-200 text-gray-500" : "bg-black text-white hover:bg-black/90",
            )}
          >
            {saving ? "Запазване..." : "Запази промените"}
          </button>
          <p className="mt-3 text-center text-xs text-black/45">
            <Link
              href="/organizer/dashboard"
              className="text-black underline decoration-black/35 underline-offset-2 hover:decoration-black"
            >
              Към таблото
            </Link>
          </p>
        </div>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-black/50">Преглед (в реално време)</p>
        <div
          className={cn(
            pub.heroMainCard,
            "relative overflow-hidden transition-shadow duration-150 hover:shadow-md lg:sticky lg:top-6",
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-50/80 to-transparent"
            aria-hidden
          />
          <div className="relative space-y-5 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <p className={cn(pub.eyebrowMuted, "leading-snug")}>Преглед на публичния профил</p>
              {publicProfileSlug.trim() ? (
                <a
                  href={`/organizers/${publicProfileSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "shrink-0 rounded-full border border-amber-200/50 bg-white/95 px-3 py-1.5 text-xs font-medium text-[#0c0e14] ring-1 ring-amber-100/35 transition hover:bg-amber-50/50 hover:opacity-90",
                    pub.focusRing,
                  )}
                >
                  Отвори ↗
                </a>
              ) : null}
            </div>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
              <OrganizerProfileLogo
                variant="hero"
                logoUrl={previewLogoUrl}
                name={form.name.trim() || "Организатор"}
                initials={previewInitials}
                resetKey={organizerId}
              />

              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className={pub.eyebrow}>Организатор на събития</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3">
                    <h2 className={cn(pub.displayH1, "text-[1.35rem] leading-tight sm:text-2xl")}>
                      {form.name.trim() || "Име на организатора"}
                    </h2>
                    {verifiedPreview ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100/80">
                        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M16.403 8.064C15.796 7.597 15.25 7.053 14.78 6.443a.75.75 0 0 0-1.06-.093l-4.47 3.73-1.94-1.94a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.09-.04l5-4.17a.75.75 0 0 0 .053-1.06Z"
                            clipRule="evenodd"
                          />
                          <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM3.5 10a6.5 6.5 0 0 1 13 0 6.5 6.5 0 0 1-13 0Z" />
                        </svg>
                        Потвърден във Festivo
                      </span>
                    ) : null}
                  </div>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-sm ring-1",
                    previewCityIsFallback
                      ? "border-dashed border-amber-200/55 bg-amber-50/35 font-medium text-black/50 ring-amber-100/20"
                      : "border-amber-200/45 bg-white font-medium text-[#0c0e14] ring-amber-100/25",
                  )}
                >
                  <svg className="h-3.5 w-3.5 shrink-0 text-black/40" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M9.69 1.87a.75.75 0 0 1 .62 0l6.25 2.858a.75.75 0 0 1 .44.684v6.728a5.75 5.75 0 0 1-2.33 4.63l-4.21 3.37a.75.75 0 0 1-.94 0l-4.21-3.37a5.75 5.75 0 0 1-2.33-4.63V5.412a.75.75 0 0 1 .44-.684L9.69 1.87ZM10 3.16 4.25 5.79v5.19a4.25 4.25 0 0 0 1.72 3.42l3.53 2.82 3.53-2.82a4.25 4.25 0 0 0 1.72-3.42V5.79L10 3.16Z"
                      clipRule="evenodd"
                    />
                    <path d="M10 7.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM6.25 9.5a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0Z" />
                  </svg>
                  {previewCityLabel}
                </span>

                {hasSocialOrWeb ? (
                  <div className="space-y-2">
                    <p className={pub.eyebrowMuted}>Връзки</p>
                    <div className="flex flex-wrap gap-2">
                      {previewWebsiteHref ? (
                        <a
                          href={previewWebsiteHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            pub.btnSecondary,
                            "gap-2 rounded-full px-4 py-2 text-sm normal-case transition hover:opacity-80",
                            pub.focusRing,
                          )}
                        >
                          Уебсайт
                          <ExternalLinkIcon className="h-3.5 w-3.5 text-black/40" />
                        </a>
                      ) : null}
                      {previewFacebookHref ? (
                        <a
                          href={previewFacebookHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-[#1877F2]/12 px-4 py-2 text-sm font-semibold text-[#145dbf] ring-1 ring-[#1877F2]/25 transition hover:bg-[#1877F2]/18 hover:opacity-90"
                        >
                          Facebook
                          <ExternalLinkIcon className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      ) : null}
                      {previewInstagramHref ? (
                        <a
                          href={previewInstagramHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-[#E1306C]/10 px-4 py-2 text-sm font-semibold text-[#bf2558] ring-1 ring-[#E1306C]/22 transition hover:bg-[#E1306C]/14 hover:opacity-90"
                        >
                          Instagram
                          <ExternalLinkIcon className="h-3.5 w-3.5 opacity-70" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {previewEmail || previewPhone ? (
                  <div className={cn(pub.railCard, "p-4 sm:p-5")}>
                    <p className={pub.eyebrowMuted}>Контакт</p>
                    <dl className="mt-3 space-y-1 text-sm">
                      {previewEmail ? (
                        <div>
                          <dt className="text-xs font-medium text-black/50">Имейл</dt>
                          <dd className="mt-0.5">
                            <a
                              href={`mailto:${previewEmail}`}
                              className={cn(pub.linkInline, "inline-block underline-offset-4 transition hover:underline")}
                            >
                              {previewEmail}
                            </a>
                          </dd>
                        </div>
                      ) : null}
                      {previewPhone ? (
                        <div>
                          <dt className="text-xs font-medium text-black/50">Телефон</dt>
                          <dd className="mt-0.5">
                            <a
                              href={telHref(previewPhone)}
                              className={cn(pub.linkInline, "inline-block underline-offset-4 transition hover:underline")}
                            >
                              {previewPhone}
                            </a>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                ) : null}

                <div className="border-t border-amber-200/35 pt-4">
                  {form.description.trim() ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/70">{form.description}</p>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-amber-200/55 bg-amber-50/40 px-4 py-4 text-center ring-1 ring-amber-100/25">
                      <p className="text-sm font-medium text-black/70">Няма добавено описание за този организатор.</p>
                      <p className="mt-1 text-xs leading-relaxed text-black/55">Добави текст в полето „Описание“ отляво.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
