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
import { useDebouncedSave } from "@/lib/hooks/useDebouncedSave";
import { useDirtyState } from "@/lib/hooks/useDirtyState";
import { computeOrganizerCompleteness } from "@/lib/organizer/profileCompleteness";
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
  initialCity: OrganizerCityOption | null;
  /** Published festival count for this organizer — feeds the completeness indicator. */
  festivalCount: number;
  initial: {
    name: string;
    description: string;
    logo_url: string;
    website_url: string;
    facebook_url: string;
    instagram_url: string;
    email: string;
    phone: string;
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
  initialCity,
  festivalCount,
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

  const completeness = useMemo(
    () =>
      computeOrganizerCompleteness({
        logo_url: snapshot.logo_url,
        description: snapshot.description,
        website_url: snapshot.website_url,
        facebook_url: snapshot.facebook_url,
        instagram_url: snapshot.instagram_url,
        email: snapshot.email,
        phone: snapshot.phone,
        festivalCount,
      }),
    [snapshot, festivalCount],
  );

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
        city_id?: number | null;
        error?: string;
      };

      if (!response.ok) {
        setSaveStatus("error");
        setApiError(typeof body.error === "string" ? body.error : SUBMIT_ERROR_FALLBACK);
        return false;
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

  const missingLabels = completeness.items.filter((item) => !item.done).map((item) => item.label);
  const completenessPercent = Math.round((completeness.doneCount / completeness.total) * 100);

  return (
    <div ref={rootRef} className="max-w-2xl" onClickCapture={handleNavigation}>
      <form onSubmit={onSubmit} className="flex flex-col rounded-2xl border border-black/[0.08] bg-white/90 shadow-sm md:pb-0">
        <div className="space-y-0 px-6 pb-6 pt-6 md:px-8 md:pt-8">
          <div className="rounded-xl border border-amber-200/55 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[#0c0e14]">Пълнота на профила</p>
              <span className="text-xs font-medium text-black/55">
                {completeness.doneCount}/{completeness.total} попълнени
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completenessPercent}%` }}
              />
            </div>
            {missingLabels.length > 0 ? (
              <p className="mt-2 text-xs text-black/55">Липсва: {missingLabels.join(", ")}</p>
            ) : (
              <p className="mt-2 text-xs font-medium text-emerald-700">Профилът е напълно попълнен 🎉</p>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-6">
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
    </div>
  );
}
