"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const FESTIVO_COOKIE_CONSENT_KEY = "festivo_cookie_consent";

export type FestivoCookieConsent = {
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

function readStoredConsent(): FestivoCookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FESTIVO_COOKIE_CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (typeof o.analytics !== "boolean" || typeof o.marketing !== "boolean" || typeof o.timestamp !== "string") {
      return null;
    }
    return { analytics: o.analytics, marketing: o.marketing, timestamp: o.timestamp };
  } catch {
    return null;
  }
}

function persistConsent(consent: FestivoCookieConsent) {
  window.localStorage.setItem(FESTIVO_COOKIE_CONSENT_KEY, JSON.stringify(consent));
}

type ConsentSwitchRowProps = {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange?: (next: boolean) => void;
  locked?: boolean;
};

function ConsentSwitchRow({ id, label, description, checked, onChange, locked }: ConsentSwitchRowProps) {
  const disabled = Boolean(locked);
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#0c0e14]" id={`${id}-label`}>
          {label}
          {locked ? (
            <span className="ml-1.5 text-xs font-medium normal-case text-amber-900/55">(винаги активни)</span>
          ) : null}
        </p>
        {description ? <p className="mt-0.5 text-xs text-amber-900/65">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative box-border h-6 w-11 shrink-0 overflow-hidden rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3]",
          checked
            ? "border-[#7c2d12]/40 bg-[#7c2d12]"
            : "border-amber-200/80 bg-amber-100/60",
          disabled && "cursor-not-allowed opacity-90",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-0.5 top-1/2 block size-5 -translate-y-1/2 rounded-full bg-white shadow-sm ring-1 ring-black/[0.06] transition-transform duration-200 ease-out will-change-transform",
            checked ? "translate-x-[1.125rem]" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export default function CookieConsentBanner() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = readStoredConsent();
    setOpen(existing === null);
    setReady(true);
  }, []);

  const closeWith = useCallback((next: FestivoCookieConsent) => {
    persistConsent(next);
    setOpen(false);
  }, []);

  const onAcceptSelected = useCallback(() => {
    closeWith({
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    });
  }, [analytics, marketing, closeWith]);

  const onAcceptAll = useCallback(() => {
    closeWith({
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    });
  }, [closeWith]);

  if (!ready || !open) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center md:justify-end md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
    >
      <div
        className={cn(
          "pointer-events-auto w-full border border-amber-200 bg-[#faf8f3] shadow-lg md:max-w-md",
          "rounded-t-2xl border-b-0 md:rounded-2xl md:border-b",
          "pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:pb-5",
        )}
      >
        <div className="px-4 md:px-5">
          <h2 id="cookie-consent-title" className="font-display text-lg font-semibold tracking-tight text-[#0c0e14] md:text-xl">
            Използваме бисквитки
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-950/80">
            За да работи сайтът правилно и да подобряваме услугата, използваме бисквитки. Можеш да избереш кои да приемеш.
          </p>

          <div className="mt-3 divide-y divide-amber-200/60 border-y border-amber-200/60">
            <ConsentSwitchRow id="essential" label="Задължителни" description="Необходими за основни функции на сайта." checked locked />
            <ConsentSwitchRow
              id="analytics"
              label="Аналитични"
              description="Google Analytics — анонимна статистика за посещения."
              checked={analytics}
              onChange={setAnalytics}
            />
            <ConsentSwitchRow
              id="marketing"
              label="Маркетингови"
              description="Meta Pixel — персонализирани реклами и измерване."
              checked={marketing}
              onChange={setMarketing}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={onAcceptSelected}
                className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl border border-amber-200/90 bg-white px-4 text-sm font-semibold text-[#7c2d12] shadow-sm transition hover:bg-amber-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/30"
              >
                Приеми избраните
              </button>
              <button
                type="button"
                onClick={onAcceptAll}
                className="inline-flex min-h-[2.5rem] items-center justify-center rounded-xl bg-[#7c2d12] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6a2810] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#faf8f3]"
              >
                Приеми всички
              </button>
            </div>
            <Link
              href="/cookies"
              className="text-center text-sm font-semibold text-[#7c2d12] underline-offset-2 hover:underline sm:text-left"
            >
              Научи повече
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
