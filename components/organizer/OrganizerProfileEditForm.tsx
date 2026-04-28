"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
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

type OrganizerProfileEditFormProps = {
  organizerId: string;
  /** Public profile path segment: `/organizers/{slug}` */
  publicProfileSlug: string;
  initial: {
    name: string;
    description: string;
    logo_url: string;
    website_url: string;
    facebook_url: string;
  };
};

export default function OrganizerProfileEditForm({
  organizerId,
  publicProfileSlug,
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
  });
  const [uploading, setUploading] = useState(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const submitFocusTimeoutRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  const interactedRef = useRef(false);
  const confirmRef = useRef(false);

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

  function isValidUrl(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

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

    const payload = {
      name: form.name.trim(),
      description: form.description,
      logo_url: form.logo_url.trim(),
      website_url: normalizeUrl(form.website_url.trim()),
      facebook_url: form.facebook_url.trim(),
    };

    if (!payload.name) {
      setError("Името е задължително");
      return;
    }
    if (payload.website_url && !isValidUrl(payload.website_url)) {
      setError("Невалиден уебсайт URL");
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

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(typeof body.error === "string" ? body.error : SUBMIT_ERROR_FALLBACK);
        return;
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

  const previewWebsite = form.website_url.trim();
  function resolvePublicWebsiteHref(raw: string): string | null {
    if (!raw) return null;
    if (isValidUrl(raw)) return raw;
    const withProto = raw.startsWith("//") ? `https:${raw}` : `https://${raw}`;
    return isValidUrl(withProto) ? withProto : null;
  }
  const previewWebsiteHref = resolvePublicWebsiteHref(previewWebsite);

  return (
    <div
      ref={rootRef}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr),minmax(260px,340px)] lg:items-start"
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
        className="space-y-5 rounded-2xl border border-black/[0.08] bg-white/90 p-6 shadow-sm md:p-8"
      >
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-[#0c0e14]">
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
            className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-[#0c0e14]">
            Описание
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={form.description}
            onChange={(e) => {
              handleFieldChange();
              setForm((f) => ({ ...f, description: e.target.value }));
            }}
            className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#0c0e14]">Лого</label>
          <div className="mt-1 space-y-3">
            <div>
              <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-black/[0.16] bg-white px-4 py-2 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.04]">
                <span>{uploading ? "Качване..." : "Качи изображение"}</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="sr-only" disabled={uploading} />
              </label>
            </div>
            <p className="text-xs text-gray-500">или</p>
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
                  className="mt-1 text-xs text-gray-500 underline"
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

        <div>
          <label htmlFor="website" className="mb-1 block text-sm font-medium text-[#0c0e14]">
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
            className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
          />
          <p className="mt-1 text-xs text-gray-500">Въведи сайт (напр. vratsa.bg)</p>
        </div>

        <div>
          <label htmlFor="facebook" className="mb-1 block text-sm font-medium text-[#0c0e14]">
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
            className="w-full rounded-lg border border-black/[0.16] bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
          />
        </div>

        {error ? (
          <div id="aria_block_error" role="alert" aria-live="assertive" aria-atomic="true">
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        ) : null}
        {success ? (
          <div id="aria_block_success" role="status" aria-live="polite" aria-atomic="true">
            <div className="mt-2 space-y-2">
              <p className="text-base font-medium text-green-600">
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
            "rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed",
            loading || !isDirty
              ? "cursor-not-allowed bg-gray-200 text-gray-500"
              : "bg-black text-white hover:bg-black/90",
            loading ? "opacity-90" : !isDirty ? "opacity-50" : null,
          )}
        >
          {loading ? "Запазване..." : "Запази промените"}
        </button>
        {isDirty ? (
          <p className="mt-1 text-xs text-orange-600">Има незапазени промени — не забравяй да запазиш</p>
        ) : null}
        {!isDirty && !loading ? <p className="mt-1 text-xs text-gray-500">Няма направени промени</p> : null}
      </form>

      <div className="rounded-xl border p-4 bg-gray-50 transition-shadow duration-150 hover:shadow-md lg:sticky lg:top-6">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="min-w-0 text-xs font-semibold uppercase tracking-wide text-black/45">
            Така ще виждат профила ти посетителите
          </p>
          {publicProfileSlug.trim() ? (
            <a
              href={`/organizers/${publicProfileSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border border-black/20 bg-white px-2 py-1 text-xs text-black transition hover:bg-black/[0.04]"
            >
              Виж публичния профил ↗
            </a>
          ) : null}
        </div>
        <div className="space-y-3">
          {form.logo_url.trim() ? (
            <img src={form.logo_url.trim()} alt="" className="h-14 w-14 rounded-lg border border-black/[0.08] object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-black/20 bg-white text-xs text-black/40">
              Лого
            </div>
          )}
          <div>
            <p className="font-[var(--font-display)] text-lg font-bold tracking-tight text-[#0c0e14]">
              {form.name.trim() || "Име на организатора"}
            </p>
          </div>
          {form.description.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/70">{form.description}</p>
          ) : (
            <p className="text-sm italic text-black/40">Няма описание</p>
          )}
          {previewWebsite ? (
            previewWebsiteHref ? (
              <a
                href={previewWebsiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-black underline decoration-black/30 underline-offset-2 hover:decoration-black"
              >
                {previewWebsite}
              </a>
            ) : (
              <p className="text-sm text-black/70">{previewWebsite}</p>
            )
          ) : (
            <p className="text-sm text-black/40">Няма уебсайт</p>
          )}
        </div>
      </div>
    </div>
  );
}
