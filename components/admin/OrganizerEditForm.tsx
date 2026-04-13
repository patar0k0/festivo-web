"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OrganizerEditInitialCity, OrganizerEditWorkspace } from "@/lib/admin/organizerEditWorkspace";
import { formatDateValueAsDdMmYyyy } from "@/lib/dates/euDateFormat";
import { festivalSettlementDisplayText } from "@/lib/settlements/formatDisplayName";
import { normalizeExternalHttpHref } from "@/lib/urls/externalHref";
import { getAIProviderLabel } from "@/lib/ai/providerUi";
import OrganizerProfileLogo from "@/components/organizers/OrganizerProfileLogo";
import OrganizerOwnershipSection, { type OrganizerOwnershipMember } from "@/components/admin/OrganizerOwnershipSection";
import AdminDateTimeLocalInput from "@/components/admin/inputs/AdminDateTimeLocalInput";

const ORGANIZER_RESEARCH_PROVIDER = "perplexity";

type OrganizerRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
  verified: boolean | null;
  city_id: number | null;
  plan: "free" | "vip" | null;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  included_promotions_per_year: number | null;
  organizer_rank: number | null;
  claimed_events_count: number | null;
  created_at: string | null;
};

function toDatetimeLocalValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type OrganizerAiResearchResult = {
  name: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  email: string | null;
  phone: string | null;
  source_urls: string[];
  confidence: "low" | "medium" | "high";
  missing_fields: string[];
};

function organizerInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  const single = parts[0] ?? name;
  return single.slice(0, 2).toUpperCase();
}

function SectionCard({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-black/[0.08] bg-white/90 p-4 shadow-[0_1px_0_rgba(12,14,20,0.04)] ${className}`.trim()}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{title}</h2>
      {description ? <p className="mt-1 text-xs text-black/55">{description}</p> : null}
      <div className={description ? "mt-4" : "mt-3"}>{children}</div>
    </section>
  );
}

function CompletenessRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] py-2 text-sm last:border-b-0">
      <span className="text-black/70">{label}</span>
      <span className={ok ? "font-semibold text-[#1f7a37]" : "text-black/40"}>{ok ? "Да" : "Не"}</span>
    </div>
  );
}

type ResolvedCityApi = { id: number; name_bg: string; slug: string; is_village: boolean | null };

export default function OrganizerEditForm({
  organizer,
  workspace,
  members,
}: {
  organizer: OrganizerRecord;
  workspace: OrganizerEditWorkspace;
  members: OrganizerOwnershipMember[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [researching, setResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [researchSuccess, setResearchSuccess] = useState<string | null>(null);
  const [researchQuery, setResearchQuery] = useState(organizer.name ?? "");
  const [researchResult, setResearchResult] = useState<OrganizerAiResearchResult | null>(null);
  const [form, setForm] = useState({
    name: organizer.name ?? "",
    slug: organizer.slug ?? "",
    description: organizer.description ?? "",
    logo_url: organizer.logo_url ?? "",
    website_url: organizer.website_url ?? "",
    facebook_url: organizer.facebook_url ?? "",
    instagram_url: organizer.instagram_url ?? "",
    email: organizer.email ?? "",
    phone: organizer.phone ?? "",
    verified: Boolean(organizer.verified),
    plan: organizer.plan === "vip" ? "vip" : "free",
    plan_started_at: toDatetimeLocalValue(organizer.plan_started_at),
    plan_expires_at: toDatetimeLocalValue(organizer.plan_expires_at),
    included_promotions_per_year: organizer.included_promotions_per_year != null ? String(organizer.included_promotions_per_year) : "0",
    organizer_rank: organizer.organizer_rank != null ? String(organizer.organizer_rank) : "0",
  });

  const [pickedCity, setPickedCity] = useState<OrganizerEditInitialCity | null>(workspace.initialCity);
  const [cityQuery, setCityQuery] = useState(workspace.initialCity?.name_bg ?? "");
  const [citySuggestions, setCitySuggestions] = useState<ResolvedCityApi[]>([]);
  const [cityBusy, setCityBusy] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPickedCity(workspace.initialCity);
    setCityQuery(workspace.initialCity?.name_bg ?? "");
    setCitySuggestions([]);
  }, [organizer.id, workspace.initialCity]);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    const q = cityQuery.trim();
    if (!q) {
      setCitySuggestions([]);
      setCityBusy(false);
      return;
    }
    if (pickedCity && q === pickedCity.name_bg.trim()) {
      setCitySuggestions([]);
      setCityBusy(false);
      return;
    }

    cityDebounceRef.current = setTimeout(async () => {
      setCityBusy(true);
      try {
        const res = await fetch(`/admin/api/cities/resolve?q=${encodeURIComponent(q)}`);
        const data = (await res.json().catch(() => ({}))) as ResolvedCityApi & {
          error?: string;
          suggestions?: ResolvedCityApi[];
        };
        if (res.ok && typeof data.id === "number" && data.name_bg) {
          setPickedCity({
            id: data.id,
            name_bg: data.name_bg,
            slug: data.slug,
            is_village: data.is_village ?? null,
          });
          setCityQuery(data.name_bg);
          setCitySuggestions([]);
        } else if (res.status === 404 && Array.isArray(data.suggestions)) {
          setCitySuggestions(data.suggestions);
        } else {
          setCitySuggestions([]);
        }
      } catch {
        setCitySuggestions([]);
      } finally {
        setCityBusy(false);
      }
    }, 380);

    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    };
  }, [cityQuery, pickedCity]);

  const completeness = useMemo(() => {
    const hasSocial = Boolean(form.facebook_url?.trim() || form.instagram_url?.trim());
    return {
      logo: Boolean(form.logo_url?.trim()),
      description: Boolean(form.description?.trim()),
      website: Boolean(form.website_url?.trim()),
      social: hasSocial,
      festivals: workspace.counts.visibleCatalog > 0,
      verified: Boolean(form.verified),
    };
  }, [form.description, form.facebook_url, form.instagram_url, form.logo_url, form.verified, form.website_url, workspace.counts.visibleCatalog]);

  async function runOrganizerResearch() {
    const query = researchQuery.trim() || form.name.trim();
    if (!query) {
      setResearchError("Organizer name/query is required.");
      return;
    }

    setResearching(true);
    setResearchError(null);
    setResearchSuccess(null);

    try {
      const response = await fetch("/api/admin/research-organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; result?: OrganizerAiResearchResult } | null;
      if (!response.ok || !payload?.result) {
        throw new Error(payload?.error ?? `Organizer ${getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)} research failed.`);
      }

      setResearchResult(payload.result);
      setResearchSuccess(`Organizer ${getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)} research completed.`);
    } catch (researchRunError) {
      setResearchError(
        researchRunError instanceof Error
          ? researchRunError.message
          : `Unexpected organizer ${getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)} research error.`,
      );
    } finally {
      setResearching(false);
    }
  }

  function applyResearchValues() {
    if (!researchResult) return;

    setForm((prev) => ({
      ...prev,
      name: researchResult.name ?? prev.name,
      description: researchResult.description ?? prev.description,
      logo_url: researchResult.logo_url ?? prev.logo_url,
      website_url: researchResult.website_url ?? prev.website_url,
      facebook_url: researchResult.facebook_url ?? prev.facebook_url,
      instagram_url: researchResult.instagram_url ?? prev.instagram_url,
      email: researchResult.email ?? prev.email,
      phone: researchResult.phone ?? prev.phone,
    }));

    setResearchSuccess(
      `${getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)} values applied to the form. Save organizer to persist.`,
    );
    setResearchError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/admin/api/organizers/${organizer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          city_id: pickedCity?.id ?? null,
          included_promotions_per_year:
            form.included_promotions_per_year.trim() === "" ? null : Number(form.included_promotions_per_year),
          organizer_rank: form.organizer_rank.trim() === "" ? null : Number(form.organizer_rank),
          plan_started_at: form.plan_started_at || null,
          plan_expires_at: form.plan_expires_at || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update organizer");
      }

      setSuccess("Organizer updated.");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this organizer? This will remove it from active organizers.");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/admin/api/organizers/${organizer.id}`, {
        method: "DELETE",
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete organizer");
      }

      router.push("/admin/organizers");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unexpected error");
    } finally {
      setDeleting(false);
    }
  }

  const publicSlug = form.slug.trim();
  const publicHref = publicSlug ? `/organizers/${encodeURIComponent(publicSlug)}` : null;
  const previewCity = (() => {
    const rel = pickedCity ?? workspace.initialCity;
    if (!rel?.name_bg?.trim()) return null;
    return festivalSettlementDisplayText(rel.name_bg, rel.is_village ?? undefined)?.trim() ?? null;
  })();

  const previewWebsiteHref = normalizeExternalHttpHref(form.website_url);
  const previewFacebookHref = normalizeExternalHttpHref(form.facebook_url);
  const previewInstagramHref = normalizeExternalHttpHref(form.instagram_url);
  const previewDescription = form.description?.trim() || null;

  return (
    <form id="organizer-workspace-form" onSubmit={onSubmit} className="space-y-4">
      {/* Summary strip */}
      <div className="rounded-2xl border border-black/[0.1] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/40">Работно място · организатор</p>
            <h1 className="truncate text-xl font-bold tracking-tight text-[#0c0e14] md:text-2xl">{form.name.trim() || "—"}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-black/60">
              <span className="font-mono text-xs text-black/50">{publicSlug || "няма-slug"}</span>
              <label className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-black/[0.02] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-black/55">
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(e) => updateField("verified", e.target.checked)}
                  className="rounded border-black/30"
                />
                verified
              </label>
            </div>
            {publicHref ? (
              <a
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                className="inline-block max-w-full truncate font-mono text-xs font-semibold text-[#0e7a45] hover:underline"
              >
                {publicHref}
              </a>
            ) : (
              <p className="text-xs text-black/45">Публичен линк ще е наличен след като зададете slug.</p>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <div className="flex flex-wrap gap-2 text-center">
              <div className="min-w-[5.5rem] rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2">
                <p className="text-lg font-bold tabular-nums text-[#0c0e14]">{workspace.counts.visibleCatalog}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">каталог</p>
              </div>
              <div className="min-w-[5.5rem] rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2">
                <p className="text-lg font-bold tabular-nums text-[#0c0e14]">{workspace.counts.linkedTotal}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">връзки</p>
              </div>
              <div className="min-w-[5.5rem] rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2">
                <p className="text-lg font-bold tabular-nums text-[#0c0e14]">{workspace.counts.pendingFestivals}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">pending</p>
              </div>
              <div className="min-w-[5.5rem] rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2">
                <p className="text-lg font-bold tabular-nums text-[#0c0e14]">{workspace.counts.pendingClaims}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-black/45">claims</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || deleting}
                className="rounded-lg bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
              >
                {saving ? "Запис…" : "Запази"}
              </button>
              {publicHref ? (
                <Link
                  href={publicHref}
                  target="_blank"
                  className="inline-flex items-center justify-center rounded-lg border border-black/[0.12] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] hover:bg-black/[0.03]"
                >
                  Публичен изглед
                </Link>
              ) : null}
              <button
                type="button"
                disabled={saving || deleting}
                onClick={onDelete}
                className="rounded-lg border border-[#b13a1a]/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#b13a1a] hover:bg-[#b13a1a]/5 disabled:opacity-50"
              >
                {deleting ? "…" : "Изтрий"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_minmax(240px,280px)] lg:items-start">
        <div className="space-y-4">
          <SectionCard title="Публичен профил" description="Полета, които виждат посетителите в каталога.">
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Име</span>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Slug</span>
                <input
                  value={form.slug}
                  onChange={(e) => updateField("slug", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Описание</span>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Лого (URL)</span>
                <input
                  value={form.logo_url}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Уебсайт</span>
                <input
                  value={form.website_url}
                  onChange={(e) => updateField("website_url", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Facebook</span>
                <input
                  value={form.facebook_url}
                  onChange={(e) => updateField("facebook_url", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Instagram</span>
                <input
                  value={form.instagram_url}
                  onChange={(e) => updateField("instagram_url", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Имейл</span>
                <input
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Телефон</span>
                <input
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                />
              </label>
              <div className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">Населено място</span>
                <div className="relative mt-2">
                  <input
                    value={cityQuery}
                    onChange={(e) => {
                      setCityQuery(e.target.value);
                      if (pickedCity && e.target.value.trim() !== pickedCity.name_bg.trim()) {
                        setPickedCity(null);
                      }
                    }}
                    placeholder="Започнете да пишете име или slug…"
                    autoComplete="off"
                    className="w-full rounded-xl border border-black/[0.1] px-3 py-2 text-sm"
                  />
                  {cityBusy ? <p className="mt-1 text-xs text-black/45">Търсене…</p> : null}
                  {pickedCity ? (
                    <p className="mt-1 text-xs font-medium text-[#1f7a37]">Избрано: {pickedCity.name_bg}</p>
                  ) : cityQuery.trim() ? (
                    <p className="mt-1 text-xs text-amber-800/90">Няма избран запис — изберете от подсказките или уточнете текста.</p>
                  ) : null}
                  {citySuggestions.length > 0 ? (
                    <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-black/[0.1] bg-white py-1 text-sm shadow-lg">
                      {citySuggestions.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-black/[0.04]"
                            onClick={() => {
                              setPickedCity({
                                id: c.id,
                                name_bg: c.name_bg,
                                slug: c.slug,
                                is_village: c.is_village ?? null,
                              });
                              setCityQuery(c.name_bg);
                              setCitySuggestions([]);
                            }}
                          >
                            {c.name_bg}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-black/50 underline decoration-black/20 hover:text-black/70"
                  onClick={() => {
                    setPickedCity(null);
                    setCityQuery("");
                    setCitySuggestions([]);
                  }}
                >
                  Изчисти населено място
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Пълнота на профила" description="Индикатори за публичното представяне (само за четене).">
            <CompletenessRow ok={completeness.logo} label="Лого" />
            <CompletenessRow ok={completeness.description} label="Описание" />
            <CompletenessRow ok={completeness.website} label="Уебсайт" />
            <CompletenessRow ok={completeness.social} label="Социални мрежи" />
            <CompletenessRow ok={completeness.festivals} label="Поне един фестивал в каталога" />
            <CompletenessRow ok={completeness.verified} label="Verified" />
          </SectionCard>

          <section className="rounded-2xl border border-dashed border-black/[0.12] bg-[#fafafa] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">
              {getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)} · второстепенно
            </p>
            <p className="mt-1 text-xs text-black/55">Изследване и подсказки; записът остава ръчен.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                placeholder="Заявка за търсене"
                className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={runOrganizerResearch}
                disabled={researching}
                className="rounded-xl bg-[#0c0e14] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white disabled:opacity-50"
              >
                {researching ? "…" : `Research (${getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)})`}
              </button>
              <button
                type="button"
                onClick={applyResearchValues}
                disabled={!researchResult || researching}
                className="rounded-xl border border-black/[0.12] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] disabled:opacity-50"
              >
                Apply ({getAIProviderLabel(ORGANIZER_RESEARCH_PROVIDER)})
              </button>
            </div>
            {researchError ? <p className="mt-2 text-sm text-[#b13a1a]">{researchError}</p> : null}
            {researchSuccess ? <p className="mt-2 text-sm text-[#1f7a37]">{researchSuccess}</p> : null}
            {researchResult ? (
              <div className="mt-3 grid gap-3 text-xs text-black/65 md:grid-cols-2">
                <p>
                  <span className="text-black/45">confidence:</span> {researchResult.confidence}
                </p>
                <p className="md:col-span-2">{researchResult.description ?? "—"}</p>
              </div>
            ) : null}
          </section>

          <SectionCard title="Свързани фестивали" description="Последни записи по дата на начало; всички връзки в брояча по-горе.">
            {workspace.linkedFestivals.length === 0 ? (
              <p className="text-sm text-black/55">Няма свързани фестивали в базата.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-black/[0.08]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-black/[0.03] text-xs uppercase tracking-[0.12em] text-black/50">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Заглавие</th>
                      <th className="px-3 py-2 font-semibold">Дата</th>
                      <th className="px-3 py-2 font-semibold">Град</th>
                      <th className="px-3 py-2 font-semibold">Статус</th>
                      <th className="px-3 py-2 font-semibold">Връзки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspace.linkedFestivals.map((row) => {
                      const dateLabel = row.start_date ? formatDateValueAsDdMmYyyy(row.start_date) : "—";
                      const pub = row.slug ? `/festivals/${encodeURIComponent(row.slug)}` : null;
                      return (
                        <tr key={row.id} className="border-t border-black/[0.06]">
                          <td className="px-3 py-2 font-medium text-[#0c0e14]">{row.title || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-black/70">{dateLabel}</td>
                          <td className="px-3 py-2 text-black/70">{row.cityLabel}</td>
                          <td className="px-3 py-2">
                            <span className="rounded-md bg-black/[0.05] px-2 py-0.5 text-xs font-semibold uppercase tracking-tight text-black/60">
                              {row.status ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {pub ? (
                                <Link
                                  href={pub}
                                  target="_blank"
                                  className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0e7a45] hover:underline"
                                >
                                  Публичен
                                </Link>
                              ) : null}
                              <Link
                                href={`/admin/festivals/${row.id}`}
                                className="text-xs font-semibold uppercase tracking-[0.08em] text-black/55 hover:underline"
                              >
                                Админ
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Опашка и workflow"
            description="Чакащи модерации и заявки за собственост, ако има такива."
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">Pending фестивали</p>
                {workspace.pendingFestivals.length === 0 ? (
                  <p className="mt-2 text-sm text-black/55">Няма pending реда за този организатор.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {workspace.pendingFestivals.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2">
                        <span className="font-medium text-[#0c0e14]">{p.title?.trim() || "Без заглавие"}</span>
                        <span className="text-xs text-black/50">{p.cityLabel}</span>
                        <Link href={`/admin/pending-festivals/${p.id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0e7a45] hover:underline">
                          Преглед
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-black/45">Заявки (claims)</p>
                {workspace.pendingClaims.length === 0 ? (
                  <p className="mt-2 text-sm text-black/55">Няма чакащи заявки.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {workspace.pendingClaims.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-black/[0.06] bg-black/[0.02] px-3 py-2">
                        <span className="text-black/70">{c.contact_email ?? c.user_id}</span>
                        <Link href={`/admin/organizer-claims/${c.id}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-[#0e7a45] hover:underline">
                          Преглед
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link href="/admin/pending-festivals" className="inline-block text-xs font-semibold uppercase tracking-[0.1em] text-black/45 hover:underline">
                Към всички pending →
              </Link>
            </div>
          </SectionCard>

          <OrganizerOwnershipSection members={members} />

          <section className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-4 ring-1 ring-black/[0.04]">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/40">Вътрешни настройки</h2>
            <p className="mt-1 text-xs text-black/45">План, кредити и подредба в списъци — нисък приоритет за редакция.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">План</span>
                <select
                  value={form.plan}
                  onChange={(e) => updateField("plan", e.target.value as "free" | "vip")}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
                >
                  <option value="free">free</option>
                  <option value="vip">vip</option>
                </select>
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">organizer_rank</span>
                <input
                  type="number"
                  value={form.organizer_rank}
                  onChange={(e) => updateField("organizer_rank", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">plan_started_at</span>
                <AdminDateTimeLocalInput
                  value={form.plan_started_at}
                  onChange={(e) => updateField("plan_started_at", e.target.value)}
                  className="mt-2 rounded-xl"
                />
              </label>
              <label>
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">plan_expires_at</span>
                <AdminDateTimeLocalInput
                  value={form.plan_expires_at}
                  onChange={(e) => updateField("plan_expires_at", e.target.value)}
                  className="mt-2 rounded-xl"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-black/50">included_promotions_per_year</span>
                <input
                  type="number"
                  value={form.included_promotions_per_year}
                  onChange={(e) => updateField("included_promotions_per_year", e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-sm"
                />
              </label>
              <div className="md:col-span-2 text-xs text-black/50">
                Claimed events (брояч): <span className="font-mono tabular-nums">{organizer.claimed_events_count ?? 0}</span>
                <span className="mx-2 text-black/25">·</span>
                Създаден:{" "}
                <span className="font-mono">{organizer.created_at ? new Date(organizer.created_at).toLocaleString("bg-BG") : "—"}</span>
              </div>
            </div>
          </section>
        </div>

        {/* Public preview card */}
        <aside className="lg:sticky lg:top-4">
          <div className="rounded-2xl border border-black/[0.1] bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Публичен преглед</p>
            <div className="mt-4 flex gap-3">
              <OrganizerProfileLogo
                logoUrl={form.logo_url}
                name={form.name.trim() || organizer.name}
                initials={organizerInitialsFromName(form.name.trim() || organizer.name)}
                resetKey={organizer.id}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate font-semibold text-[#0c0e14]">{form.name.trim() || "—"}</p>
                {previewCity ? <p className="text-sm text-black/55">{previewCity}</p> : <p className="text-sm text-black/40">Без населено място</p>}
                <p className="text-xs text-black/45">
                  {workspace.counts.visibleCatalog}{" "}
                  {workspace.counts.visibleCatalog === 1 ? "фестивал в каталога" : "фестивала в каталога"}
                </p>
              </div>
            </div>
            {previewDescription ? (
              <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-black/65">{previewDescription}</p>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-black/[0.1] bg-black/[0.02] px-3 py-3 text-sm text-black/45">
                Няма кратко описание — в каталога ще се покаже общ текст по подразбиране.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
              {previewWebsiteHref ? (
                <a
                  href={previewWebsiteHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#0e7a45] hover:underline"
                >
                  Уебсайт
                </a>
              ) : null}
              {previewFacebookHref ? (
                <a
                  href={previewFacebookHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#1877F2] hover:underline"
                >
                  Facebook
                </a>
              ) : null}
              {previewInstagramHref ? (
                <a
                  href={previewInstagramHref}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#E1306C] hover:underline"
                >
                  Instagram
                </a>
              ) : null}
              {!previewWebsiteHref && !previewFacebookHref && !previewInstagramHref ? (
                <span className="text-xs text-black/40">Няма връзки</span>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

      {error ? <p className="text-sm text-[#b13a1a]">{error}</p> : null}
      {success ? <p className="text-sm text-[#1f7a37]">{success}</p> : null}
    </form>
  );
}
