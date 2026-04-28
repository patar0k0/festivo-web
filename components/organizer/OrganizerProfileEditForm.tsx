"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import OrganizerProfileLogo from "@/components/organizers/OrganizerProfileLogo";
import { normalizeExternalHttpHref } from "@/lib/urls/externalHref";
import { pub } from "@/lib/public-ui/styles";
import { cn } from "@/lib/utils";

const UNSAVED_NAV_CONFIRM = "Имаш незапазени промени. Сигурен ли си?";

/** Minimum delay before auto-redirect after a successful save (ms). */
const POST_SAVE_REDIRECT_MS = 2000;

const SUBMIT_ERROR_FALLBACK = "Грешка при запис. Опитай отново.";

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
    /* External sites: never guard (power users / new-tab flows). */
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

export type OrganizerCityOption = { id: number; name_bg: string };

type OrganizerProfileEditFormProps = {
  organizerId: string;
  /** Public profile path segment: `/organizers/{slug}` */
  publicProfileSlug: string;
  cities: OrganizerCityOption[];
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

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-black/[0.08] bg-white/80 p-5 shadow-sm ring-1 ring-black/[0.03] md:p-6">
      <div>
        <h2 className="font-[var(--font-display)] text-base font-semibold tracking-tight text-[#0c0e14]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-black/55">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function OrganizerProfileEditForm({
  organizerId,
  publicProfileSlug,
  cities,
  initial,
}: OrganizerProfileEditFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
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
  });
  /** Synced from server after save (admin may toggle verified). */
  const [verifiedPreview, setVerifiedPreview] = useState(initial.verified);
  const [uploading, setUploading] = useState(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const submitFocusTimeoutRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const interactedRef = useRef(false);
  const confirmRef = useRef(false);

  const previewInitials = organizerInitialsFromName(form.name);
  /** Public page uses the same helper for safe external hrefs. */
  const previewWebsiteHref = normalizeExternalHttpHref(form.website_url);
  const previewFacebookHref = normalizeExternalHttpHref(form.facebook_url);
  const previewInstagramHref = normalizeExternalHttpHref(form.instagram_url);
  const hasSocialOrWeb = Boolean(previewWebsiteHref || previewFacebookHref || previewInstagramHref);
  const previewEmail = form.email.trim() || null;
  const previewPhone = form.phone.trim() || null;
  const previewCityName = cities.find((c) => c.id === form.city_id)?.name_bg ?? null;
  const previewCityLabel =
    previewCityName ?? (form.city_id == null ? "Без избран град" : "Град не е наличен");
  const previewCityIsFallback = previewCityName === null;

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
      if (submitFocusTimeoutRef.current) {
        clearTimeout(submitFocusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

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
      if (!isDirty) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement;
      const a = target.closest("a");
      if (!a || !(a instanceof HTMLAnchorElement)) return;
      if (!anchorClickWouldLeavePage(a)) return;

      const ok = tryConfirmUnsavedNavigation();
      if (!ok) e.preventDefault();
    },
    [isDirty, tryConfirmUnsavedNavigation],
  );

  /** Workspace chrome and other links outside this grid: confirm before same-window navigation. */
  useEffect(() => {
    if (!isDirty) return;

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
  }, [isDirty, tryConfirmUnsavedNavigation]);

  function clearPostSaveRedirect() {
    if (redirectTimeoutRef.current !== null) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

    interactedRef.current = false;
    setError(null);

    const websiteNorm = normalizeUrl(form.website_url.trim());
    const fbRaw = form.facebook_url.trim();
    const igRaw = form.instagram_url.trim();
    const facebookNorm = fbRaw ? normalizeUrl(fbRaw) : "";
    const instagramNorm = igRaw ? normalizeUrl(igRaw) : "";

    const payload = {
      name: form.name.trim(),
      description: form.description,
      logo_url: form.logo_url.trim(),
      website_url: websiteNorm,
      facebook_url: facebookNorm,
      instagram_url: instagramNorm,
      email: form.email.trim(),
      phone: form.phone.trim(),
      city_id: form.city_id,
    };

    if (!payload.name) {
      setError("Името е задължително");
      return;
    }
    if (payload.website_url && !isValidUrl(payload.website_url)) {
      setError("Невалиден уебсайт URL");
      return;
    }
    if (facebookNorm && !isValidUrl(facebookNorm)) {
      setError("Невалиден Facebook URL");
      return;
    }
    if (instagramNorm && !isValidUrl(instagramNorm)) {
      setError("Невалиден Instagram URL");
      return;
    }
    if (!isValidEmailLoose(payload.email)) {
      setError("Невалиден имейл адрес");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const response = await fetch(`/api/organizers/${organizerId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        verified?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setError(typeof body.error === "string" ? body.error : SUBMIT_ERROR_FALLBACK);
        return;
      }

      /* Only sync verified when API returns a real boolean — avoids stale or malformed payloads. */
      if (typeof body.verified === "boolean") {
        setVerifiedPreview(body.verified);
      }

      setSuccess(true);
      setIsDirty(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
      clearPostSaveRedirect();
      interactedRef.current = false;
      if (submitFocusTimeoutRef.current) {
        clearTimeout(submitFocusTimeoutRef.current);
      }
      submitFocusTimeoutRef.current = window.setTimeout(() => {
        submitFocusTimeoutRef.current = null;
        if (!interactedRef.current) {
          submitBtnRef.current?.focus({ preventScroll: true });
        }
      }, 1500);
      redirectTimeoutRef.current = window.setTimeout(() => {
        window.location.href = "/organizer/dashboard";
      }, POST_SAVE_REDIRECT_MS);
    } catch {
      setError(SUBMIT_ERROR_FALLBACK);
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange() {
    interactedRef.current = true;
    clearPostSaveRedirect();
    setError(null);
    if (success) setSuccess(false);
    setIsDirty(true);
  }

  function handleWebsiteBlur() {
    const normalized = normalizeUrl(form.website_url.trim());
    if (normalized === form.website_url) return;
    interactedRef.current = true;
    clearPostSaveRedirect();
    setForm((f) => ({ ...f, website_url: normalized }));
    setIsDirty(true);
    setError(null);
    if (success) setSuccess(false);
  }

  function handleSocialBlur(field: "facebook_url" | "instagram_url") {
    const raw = form[field].trim();
    if (!raw) return;
    const normalized = normalizeUrl(raw);
    if (normalized === form[field]) return;
    interactedRef.current = true;
    clearPostSaveRedirect();
    setForm((f) => ({ ...f, [field]: normalized }));
    setIsDirty(true);
    setError(null);
    if (success) setSuccess(false);
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      e.target.value = "";
      return;
    }

    interactedRef.current = true;

    if (!file.type.startsWith("image/")) {
      setError("Файлът трябва да е изображение");
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Максимален размер 2MB");
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await fetch(`/api/organizers/${organizerId}/logo`, {
        method: "POST",
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error ?? "Грешка при качване на лого");
        return;
      }

      setForm((f) => ({
        ...f,
        logo_url: data.url!,
      }));

      setIsDirty(true);
      setError(null);
      setSuccess(false);
    } catch {
      setError("Грешка при качване на лого");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div
      ref={rootRef}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(280px,380px)] lg:items-start"
      onClickCapture={handleNavigation}
      onPointerDownCapture={() => {
        interactedRef.current = true;
        if (success) clearPostSaveRedirect();
      }}
      onKeyDownCapture={() => {
        interactedRef.current = true;
        if (success) clearPostSaveRedirect();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8"
      >
        <FormSection
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
                handleFieldChange();
                setForm((f) => ({ ...f, name: e.target.value }));
              }}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />
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
                handleFieldChange();
                setForm((f) => ({ ...f, description: e.target.value }));
              }}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />
          </div>

          <div>
            <span className={pub.label}>Лого</span>
            <div className="mt-2 space-y-3">
              <div>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-black/[0.16] bg-white px-4 py-2 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.04]">
                  <span>{uploading ? "Качване..." : "Качи изображение"}</span>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" disabled={uploading} />
                </label>
              </div>
              <p className="text-xs text-black/45">или въведи директен URL</p>
              <div>
                <label htmlFor="logo_url" className="sr-only">
                  URL на лого
                </label>
                <input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  placeholder="https://..."
                  value={form.logo_url}
                  onChange={(e) => {
                    handleFieldChange();
                    setForm((f) => ({ ...f, logo_url: e.target.value }));
                  }}
                  className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
                />
              </div>
              {form.logo_url.trim() ? (
                <>
                  <img src={form.logo_url.trim()} alt="Лого преглед" className="h-16 w-16 rounded border object-cover" />
                  <button
                    type="button"
                    className="mt-1 text-xs text-black/50 underline"
                    onClick={() => {
                      handleFieldChange();
                      setForm((f) => ({ ...f, logo_url: "" }));
                    }}
                  >
                    Премахни логото
                  </button>
                </>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-black/20 bg-white text-xs text-black/40">
                  Лого
                </div>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection title="Контакт" description="Имейл, телефон и официален сайт. Показват се в публичния профил.">
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
                handleFieldChange();
                setForm((f) => ({ ...f, email: e.target.value }));
              }}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />
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
                handleFieldChange();
                setForm((f) => ({ ...f, phone: e.target.value }));
              }}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
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
                handleFieldChange();
                setForm((f) => ({ ...f, website_url: e.target.value }));
              }}
              onBlur={handleWebsiteBlur}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />
            <p className="mt-1 text-xs text-black/45">Можеш да въведеш домейн без https (напр. example.bg)</p>
          </div>
        </FormSection>

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
                handleFieldChange();
                setForm((f) => ({ ...f, facebook_url: e.target.value }));
              }}
              onBlur={() => handleSocialBlur("facebook_url")}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />
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
                handleFieldChange();
                setForm((f) => ({ ...f, instagram_url: e.target.value }));
              }}
              onBlur={() => handleSocialBlur("instagram_url")}
              className="mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
            />
          </div>
        </FormSection>

        <FormSection
          title="Локация"
          description="Основен град на организатора — показва се в публичния профил, когато е зададен."
        >
          <div>
            <label htmlFor="city_id" className={pub.label}>
              Град
            </label>
            <select
              id="city_id"
              name="city_id"
              value={form.city_id === null ? "" : String(form.city_id)}
              onChange={(e) => {
                handleFieldChange();
                const v = e.target.value;
                setForm((f) => ({ ...f, city_id: v === "" ? null : Number(v) }));
              }}
              className={cn(
                "mt-2 w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black",
              )}
            >
              <option value="">— Без избран град —</option>
              {cities.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name_bg}
                </option>
              ))}
            </select>
          </div>
        </FormSection>

        {error ? (
          <div id="aria_block_error" role="alert" aria-live="assertive" aria-atomic="true">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : null}
        {success ? (
          <div id="aria_block_success" role="status" aria-live="polite" aria-atomic="true">
            <div className="space-y-2">
              <p className="text-base font-medium text-green-700">
                ✓ Промените са запазени и вече са видими в профила ти
              </p>
              <Link
                href="/organizer/dashboard"
                className="inline-block text-sm text-black underline decoration-black/35 underline-offset-2 hover:decoration-black"
              >
                Върни се към таблото
              </Link>
            </div>
          </div>
        ) : null}

        <button
          ref={submitBtnRef}
          type="submit"
          disabled={loading || !isDirty}
          aria-busy={loading}
          aria-disabled={!isDirty || loading}
          data-loading={loading ? "true" : undefined}
          className={cn(
            "rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed",
            loading || !isDirty
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-black text-white hover:bg-black/90",
            loading ? "opacity-90" : !isDirty ? "opacity-50" : null,
          )}
        >
          {loading ? "Запазване..." : "Запази промените"}
        </button>
        {isDirty ? (
          <p className="text-xs text-amber-800/90">Има незапазени промени — не забравяй да запазиш</p>
        ) : null}
        {!isDirty && !loading ? <p className="text-xs text-black/45">Няма направени промени</p> : null}
      </form>

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
              logoUrl={form.logo_url.trim() || null}
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
  );
}
