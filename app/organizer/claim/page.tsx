"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import OrganizerClaimStepStrip from "@/components/organizer/OrganizerClaimStepStrip";
import OrganizerOnboardingValueBlock from "@/components/organizer/OrganizerOnboardingValueBlock";
import OrganizerPortalNav from "@/components/organizer/OrganizerPortalNav";
import "@/app/landing.css";

type OrganizerSuggestion = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  verified: boolean;
};

export default function OrganizerClaimPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ name: string; slug: string } | null>(null);
  const [suggestions, setSuggestions] = useState<OrganizerSuggestion[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const blurCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearBlurTimer = useCallback(() => {
    if (blurCloseTimer.current) {
      clearTimeout(blurCloseTimer.current);
      blurCloseTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (selected) {
      setSuggestions([]);
      return;
    }

    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        setSuggestions([]);
        setSearchLoading(true);
        try {
          const res = await fetch(`/api/organizer/search?q=${encodeURIComponent(q)}`, {
            signal: controller.signal,
          });
          const payload = (await res.json().catch(() => null)) as
            | { organizers?: OrganizerSuggestion[]; error?: string }
            | null;
          if (!res.ok) {
            setSuggestions([]);
            return;
          }
          setSuggestions(payload?.organizers ?? []);
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") {
            return;
          }
          setSuggestions([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 300);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, selected]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);
    const slug = selected?.slug?.trim() ?? "";
    if (!slug) {
      setError("Изберете организатор от списъка.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/organizer/claims", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error ?? "Грешка при заявката.");
      }
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неуспех.");
    } finally {
      setBusy(false);
    }
  }

  function pickOrganizer(org: OrganizerSuggestion) {
    setSelected({ name: org.name, slug: org.slug });
    setQuery("");
    setSuggestions([]);
    setDropdownOpen(false);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setSuggestions([]);
  }

  const trimmed = query.trim();
  const showDropdown = dropdownOpen && !selected && trimmed.length >= 2;
  const showEmptyState = showDropdown && !searchLoading && suggestions.length === 0;

  return (
    <div className="landing-bg min-h-screen px-4 py-8 text-[#0c0e14] md:px-6 md:py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50/95 via-white/95 to-white/90 p-6 shadow-sm ring-1 ring-amber-100/50 md:p-8">
          <Link href="/organizer" className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/45 hover:text-[#0c0e14]">
            ← Начало
          </Link>
          <h1 className="mt-4 font-[var(--font-display)] text-2xl font-bold text-[#0c0e14]">Поеми съществуващ профил</h1>
          <p className="mt-2 text-sm text-black/65">
            Организацията ти вече е в Festivo — заяви собственост върху профила. Намери организацията по име и я избери от
            предложенията.
          </p>
          <div className="mt-6">
            <OrganizerPortalNav variant="onboarding" />
          </div>
        </div>

        <OrganizerOnboardingValueBlock variant="claim" />

        <OrganizerClaimStepStrip />

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-amber-200/45 bg-white/90 p-6 shadow-sm md:p-8">
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
          {ok ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Заявката е изпратена. Ще бъде прегледана от екипа на Festivo.
            </p>
          ) : null}

          <input type="hidden" name="slug" value={selected?.slug ?? ""} readOnly />

          {selected ? (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-[#0c0e14]">Избран организатор</span>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium text-[#0c0e14]">{selected.name}</span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[#0c0e14] transition hover:bg-black/[0.03]"
                >
                  Промени
                </button>
              </div>
            </div>
          ) : (
            <div className="relative space-y-2">
              <label className="block text-sm font-medium text-[#0c0e14]" htmlFor="organizer-search">
                Търси организатор *
              </label>
              <input
                id="organizer-search"
                type="search"
                autoComplete="off"
                value={query}
                onChange={(ev) => {
                  setQuery(ev.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => {
                  blurCloseTimer.current = setTimeout(() => setDropdownOpen(false), 150);
                }}
                placeholder="напр. Община Банско"
                className="mt-1.5 w-full rounded-xl border border-black/[0.12] bg-white px-3 py-2 text-sm"
                aria-autocomplete="list"
                aria-controls="organizer-search-listbox"
              />
              {showDropdown ? (
                <ul
                  id="organizer-search-listbox"
                  role="listbox"
                  className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-black/[0.12] bg-white py-1 shadow-lg"
                >
                  {searchLoading ? (
                    <li className="px-3 py-2 text-sm text-black/55">Търсене…</li>
                  ) : showEmptyState ? (
                    <li className="px-3 py-2 text-sm text-black/55" role="status">
                      Няма намерени организатори
                    </li>
                  ) : (
                    suggestions.map((org) => (
                    <li key={org.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#0c0e14] hover:bg-amber-50/80"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          clearBlurTimer();
                        }}
                        onClick={() => pickOrganizer(org)}
                      >
                        <span className="min-w-0 flex-1">{org.name}</span>
                        {org.verified ? (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-100">
                            <span aria-hidden="true">✓</span>
                            Потвърден
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))
                  )}
                </ul>
              ) : null}
            </div>
          )}

          <p className="text-xs leading-relaxed text-black/55">
            Не намирате организацията си?{" "}
            <Link href="/organizer/profile/new" className="font-semibold text-amber-900/90 underline-offset-2 hover:underline">
              Създайте нов профил
            </Link>
            .
          </p>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#7c2d12] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5c200d] disabled:opacity-50"
          >
            {busy ? "Изпращане…" : "Заяви профил"}
          </button>
        </form>

        <p className="text-center text-xs leading-relaxed text-black/50">
          Заявката се преглежда от екипа на Festivo.
          <br />
          Няма да публикуваме промени без ваше одобрение.
        </p>
      </div>
    </div>
  );
}
