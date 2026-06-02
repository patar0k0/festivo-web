// components/admin/SmartResearchPanel.tsx
"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { SmartResearchResult, SmartResearchFields } from "@/lib/admin/research/smart-pipeline";
import type { DuplicateMatch } from "@/lib/admin/research/findDuplicateFestivals";

type PhaseStatus = "pending" | "running" | "done" | "skipped" | "error";

type PipelineStep = {
  id: string;
  label: string;
  status: PhaseStatus;
  detail?: string;
};

const INITIAL_STEPS: PipelineStep[] = [
  { id: "serpapi", label: "Google Search (EN + BG)", status: "pending" },
  { id: "perplexity", label: "Perplexity (допълнение)", status: "pending" },
  { id: "gemini", label: "Gemini extraction", status: "pending" },
];

function StepIcon({ status }: { status: PhaseStatus }) {
  if (status === "running")
    return <span className="size-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black/70 shrink-0" />;
  if (status === "done") return <span className="shrink-0 text-emerald-600 font-bold text-xs">✓</span>;
  if (status === "error") return <span className="shrink-0 text-red-500 font-bold text-xs">✗</span>;
  if (status === "skipped") return <span className="shrink-0 text-black/25 text-xs">⊘</span>;
  return <span className="size-2 rounded-full bg-black/15 shrink-0 mt-1" />;
}

function PipelineSteps({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <div key={s.id} className={`flex items-start gap-2 text-sm transition-opacity ${s.status === "pending" ? "opacity-35" : "opacity-100"}`}>
          <span className="mt-0.5 flex size-4 items-center justify-center">
            <StepIcon status={s.status} />
          </span>
          <div>
            <span className={s.status === "done" ? "text-black/70" : s.status === "error" ? "text-red-600" : s.status === "skipped" ? "text-black/30" : "text-black/60"}>
              {s.label}
            </span>
            {s.detail && <span className="ml-2 text-xs text-black/35">{s.detail}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string | null | boolean | string[] }) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === "boolean" && value === null) return null;

  const display = Array.isArray(value)
    ? value.join(" · ")
    : typeof value === "boolean"
      ? value ? "Безплатно" : "Платено"
      : value;

  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-black/40">{label}</span>
      <span className="text-black/80">{display}</span>
    </div>
  );
}

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { label: "висока", className: "bg-emerald-100 text-emerald-700" },
    medium: { label: "средна", className: "bg-amber-100 text-amber-700" },
    low: { label: "ниска", className: "bg-red-100 text-red-700" },
  };
  const { label, className } = map[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function EditLabel({ children }: { children: ReactNode }) {
  return <span className="text-[11px] font-medium uppercase tracking-wide text-black/40">{children}</span>;
}

const EDIT_INPUT_CLASS =
  "w-full rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10";

/** Compact editable form for the core extracted fields. */
function EditForm({
  fields,
  onChange,
}: {
  fields: SmartResearchFields;
  onChange: (patch: Partial<SmartResearchFields>) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-black/[0.08] bg-black/[0.015] p-4">
      <label className="block space-y-1">
        <EditLabel>Заглавие</EditLabel>
        <input
          className={EDIT_INPUT_CLASS}
          value={fields.title ?? ""}
          onChange={(e) => onChange({ title: e.target.value || null })}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <EditLabel>Начална дата</EditLabel>
          <input
            type="date"
            className={EDIT_INPUT_CLASS}
            value={fields.start_date ?? ""}
            onChange={(e) => onChange({ start_date: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Крайна дата</EditLabel>
          <input
            type="date"
            className={EDIT_INPUT_CLASS}
            value={fields.end_date ?? ""}
            onChange={(e) => onChange({ end_date: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Начален час</EditLabel>
          <input
            type="time"
            className={EDIT_INPUT_CLASS}
            value={fields.start_time ?? ""}
            onChange={(e) => onChange({ start_time: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Краен час</EditLabel>
          <input
            type="time"
            className={EDIT_INPUT_CLASS}
            value={fields.end_time ?? ""}
            onChange={(e) => onChange({ end_time: e.target.value || null })}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <EditLabel>Град</EditLabel>
          <input
            className={EDIT_INPUT_CLASS}
            value={fields.city ?? ""}
            onChange={(e) => onChange({ city: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Категория</EditLabel>
          <input
            className={EDIT_INPUT_CLASS}
            value={fields.category ?? ""}
            onChange={(e) => onChange({ category: e.target.value || null })}
          />
        </label>
      </div>

      <label className="block space-y-1">
        <EditLabel>Място / зала</EditLabel>
        <input
          className={EDIT_INPUT_CLASS}
          value={fields.location_name ?? ""}
          onChange={(e) => onChange({ location_name: e.target.value || null })}
        />
      </label>

      <label className="block space-y-1">
        <EditLabel>Адрес</EditLabel>
        <input
          className={EDIT_INPUT_CLASS}
          value={fields.address ?? ""}
          onChange={(e) => onChange({ address: e.target.value || null })}
        />
      </label>

      <label className="block space-y-1">
        <EditLabel>Организатор</EditLabel>
        <input
          className={EDIT_INPUT_CLASS}
          value={fields.organizer_name ?? ""}
          onChange={(e) => onChange({ organizer_name: e.target.value || null })}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={fields.is_free === true}
          onChange={(e) => onChange({ is_free: e.target.checked })}
        />
        <EditLabel>Безплатен вход</EditLabel>
      </label>

      <label className="block space-y-1">
        <EditLabel>Тагове (разделени със запетая)</EditLabel>
        <input
          className={EDIT_INPUT_CLASS}
          value={fields.tags.join(", ")}
          onChange={(e) =>
            onChange({
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            })
          }
        />
      </label>

      <label className="block space-y-1">
        <EditLabel>Описание</EditLabel>
        <textarea
          className={`${EDIT_INPUT_CLASS} min-h-[80px] resize-y`}
          value={fields.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value || null })}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1">
          <EditLabel>Уебсайт</EditLabel>
          <input
            className={EDIT_INPUT_CLASS}
            value={fields.website_url ?? ""}
            onChange={(e) => onChange({ website_url: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Билети</EditLabel>
          <input
            className={EDIT_INPUT_CLASS}
            value={fields.ticket_url ?? ""}
            onChange={(e) => onChange({ ticket_url: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Facebook</EditLabel>
          <input
            className={EDIT_INPUT_CLASS}
            value={fields.facebook_url ?? ""}
            onChange={(e) => onChange({ facebook_url: e.target.value || null })}
          />
        </label>
        <label className="block space-y-1">
          <EditLabel>Instagram</EditLabel>
          <input
            className={EDIT_INPUT_CLASS}
            value={fields.instagram_url ?? ""}
            onChange={(e) => onChange({ instagram_url: e.target.value || null })}
          />
        </label>
      </div>
    </div>
  );
}

function DuplicateWarning({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null;
  const hasStrong = matches.some((m) => m.same_year || m.score >= 0.6);
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-xs ${
        hasStrong
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <p className="font-semibold">
        {hasStrong ? "⚠ Възможен дубликат" : "Подобни съществуващи фестивали"}
      </p>
      <p className="mt-0.5 opacity-80">
        Провери дали вече не съществува, преди да добавиш.
      </p>
      <ul className="mt-2 space-y-1">
        {matches.map((m) => (
          <li key={`${m.table}-${m.id}`} className="flex items-center gap-2">
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-black/10">
              {m.table === "festival" ? "каталог" : "за преглед"}
            </span>
            <a
              href={m.href}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium underline hover:no-underline"
            >
              {m.title}
            </a>
            {m.start_date && (
              <span className="shrink-0 opacity-60">{formatIsoDate(m.start_date)}</span>
            )}
            {m.same_year && (
              <span className="shrink-0 rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                същата година
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function DateRange({ fields }: { fields: SmartResearchFields }) {
  const { start_date, end_date, start_time, end_time } = fields;
  if (!start_date) return null;

  const fmtStart = formatIsoDate(start_date);
  const fmtEnd = end_date && end_date !== start_date ? formatIsoDate(end_date) : null;
  const dateStr = fmtEnd ? `${fmtStart} – ${fmtEnd}` : fmtStart;

  let timeStr = "";
  if (start_time) timeStr = start_time;
  if (end_time && end_time !== start_time) timeStr = timeStr ? `${timeStr}–${end_time}` : end_time;

  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-black/40">Дати</span>
      <span className="text-black/80">
        {dateStr}
        {timeStr && <span className="ml-2 text-black/50">{timeStr}</span>}
      </span>
    </div>
  );
}

function LocationLine({ fields }: { fields: SmartResearchFields }) {
  const parts = [fields.city, fields.location_name, fields.address].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-black/40">Място</span>
      <span className="text-black/80">{parts.join(" · ")}</span>
    </div>
  );
}

function OrganizerLine({ fields }: { fields: SmartResearchFields }) {
  const names = fields.organizer_names?.length ? fields.organizer_names : fields.organizer_name ? [fields.organizer_name] : [];
  if (names.length === 0) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-black/40">Организатор</span>
      <span className="text-black/80">{names.join(", ")}</span>
    </div>
  );
}

function LinkLine({ label, url }: { label: string; url: string | null }) {
  if (!url) return null;
  const domain = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-black/40">{label}</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-600 hover:underline">
        {domain}
      </a>
    </div>
  );
}

export default function SmartResearchPanel() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [result, setResult] = useState<SmartResearchResult | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");
  const [selectedHeroImage, setSelectedHeroImage] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [dupChecking, setDupChecking] = useState(false);
  // Admin-editable copy of the extracted fields. Initialised from the result and
  // edited in-place before sending to the pipeline, so Gemini mistakes (wrong
  // date/city/title) can be corrected here instead of in the pending editor.
  const [edited, setEdited] = useState<SmartResearchFields | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const updateStep = (id: string, patch: Partial<PipelineStep>) =>
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const runResearch = async () => {
    if (!query.trim() || isLoading) return;
    setError("");
    setResult(null);
    setSendStatus("");
    setIsDone(false);
    setSteps(INITIAL_STEPS);
    setFailedImages(new Set());
    setDuplicates([]);
    setEdited(null);
    setIsEditing(false);
    setIsLoading(true);

    // Step 1: Google running immediately
    updateStep("serpapi", { status: "running" });

    // Step 2: after 3s start showing Perplexity as running (may be skipped)
    const perplexityTimer = setTimeout(() => {
      updateStep("serpapi", { status: "done" });
      updateStep("perplexity", { status: "running" });
    }, 3_000);

    // Step 3: after 6s start Gemini
    const geminiTimer = setTimeout(() => {
      setSteps((prev) => prev.map((s) => {
        if (s.id === "perplexity" && s.status === "running") return { ...s, status: "done" as PhaseStatus };
        if (s.id === "gemini") return { ...s, status: "running" as PhaseStatus };
        return s;
      }));
    }, 6_000);

    try {
      const res = await fetch("/admin/api/research-smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      clearTimeout(perplexityTimer);
      clearTimeout(geminiTimer);

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; result?: SmartResearchResult; error?: string } | null;

      if (!res.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Заявката неуспешна.");
      }

      const r = payload.result;
      const used = r.providers_used;
      const warns = r.warnings;

      // Finalize steps based on actual result
      setSteps([
        {
          id: "serpapi",
          label: "Google Search (EN + BG)",
          status: used.includes("serpapi") ? "done" : "error",
          detail: r.sources.some((s) => s.is_ai_overview) ? "AI Overview намерен" : `${r.sources.filter((s) => !s.is_ai_overview).length} резултата`,
        },
        {
          id: "perplexity",
          label: "Perplexity (допълнение)",
          status: used.includes("perplexity") ? "done" : "skipped",
          detail: used.includes("perplexity") ? "добавен контекст" : "пропуснат (достатъчно резултати)",
        },
        {
          id: "gemini",
          label: "Gemini extraction",
          status: used.includes("gemini") ? "done" : warns.some((w) => w.toLowerCase().includes("gemini")) ? "error" : "skipped",
          detail: used.includes("gemini")
            ? [r.gemini_model, `увереност: ${r.confidence}`].filter(Boolean).join(" · ")
            : warns.find((w) => w.toLowerCase().includes("gemini"))?.slice(0, 80),
        },
      ]);

      setResult(r);
      setEdited({ ...r.fields });
      setSelectedHeroImage(r.fields.hero_image_candidates[0] ?? r.fields.hero_image ?? null);
      setIsDone(true);
      void checkDuplicates(r.fields.title ?? query, r.fields.start_date);
    } catch (e) {
      clearTimeout(perplexityTimer);
      clearTimeout(geminiTimer);
      setSteps((prev) => prev.map((s) => s.status === "running" ? { ...s, status: "error" } : s));
      setError(e instanceof Error ? e.message : "Неочаквана грешка.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkDuplicates = async (title: string, startDate: string | null) => {
    if (!title.trim()) return;
    setDupChecking(true);
    try {
      const res = await fetch("/admin/api/research-smart/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), start_date: startDate }),
      });
      const payload = (await res.json().catch(() => null)) as { matches?: DuplicateMatch[] } | null;
      setDuplicates(payload?.matches ?? []);
    } catch {
      // Non-blocking: a failed duplicate check must never stop the admin from
      // adding a festival. Silently leave the list empty.
      setDuplicates([]);
    } finally {
      setDupChecking(false);
    }
  };

  const sendToPipeline = async () => {
    if (!result) return;
    setIsSending(true);
    setSendStatus("");
    try {
      const { sources, confidence } = result;
      // Prefer the admin-edited copy; fall back to the raw extraction.
      const fields = edited ?? result.fields;
      const confidenceScore = confidence === "high" ? 90 : confidence === "medium" ? 60 : 30;

      // Append year to title if not already present
      const year = fields.start_date ? new Date(fields.start_date).getFullYear().toString() : null;
      const titleWithYear =
        fields.title && year && !fields.title.includes(year)
          ? `${fields.title} ${year}`
          : fields.title;

      const data = {
        title: titleWithYear,
        description: fields.description,
        category: fields.category,
        tags: fields.tags,
        start_date: fields.start_date,
        end_date: fields.end_date,
        start_time: fields.start_time,
        end_time: fields.end_time,
        city: fields.city,
        location_name: fields.location_name,
        address: fields.address,
        organizer_name: fields.organizer_name,
        organizer_names: fields.organizer_names,
        website_url: fields.website_url,
        facebook_url: fields.facebook_url,
        instagram_url: fields.instagram_url,
        ticket_url: fields.ticket_url,
        hero_image: selectedHeroImage,
        gallery_image_urls: fields.hero_image_candidates.filter(
          (u) => u !== selectedHeroImage && !failedImages.has(u),
        ),
        is_free: fields.is_free,
        program_draft: fields.program_draft,
        source_urls: sources.filter((s) => !s.is_ai_overview).map((s) => s.url),
        confidence,
        missing_fields: [],
      };

      const res = await fetch("/admin/api/pending-festivals/direct-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, confidence_score: confidenceScore }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
      if (!res.ok || !payload?.id) throw new Error(payload?.error ?? "Неуспешно създаване.");
      router.push(`/admin/pending-festivals/${payload.id}`);
    } catch (e) {
      setSendStatus(`Грешка: ${e instanceof Error ? e.message : "Неочаквана грешка."}`);
      setIsSending(false);
    }
  };

  // Current view of the fields: edited copy when available, else raw extraction.
  const view = result ? edited ?? result.fields : null;

  const applyEdit = (patch: Partial<SmartResearchFields>) =>
    setEdited((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runResearch()}
          placeholder="Въведи фестивал + година"
          className="flex-1 rounded-xl border border-black/[0.12] bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-black/30 focus:ring-2 focus:ring-black/10"
          disabled={isLoading}
        />
        <button
          onClick={runResearch}
          disabled={!query.trim() || isLoading}
          className="rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black/80 disabled:opacity-40"
        >
          {isLoading ? "..." : "Изследвай"}
        </button>
      </div>

      {/* Pipeline steps — shown during loading and after */}
      {(isLoading || isDone || error) && (
        <div className="rounded-xl border border-black/[0.07] bg-black/[0.02] px-4 py-3">
          <PipelineSteps steps={steps} />
        </div>
      )}

      {/* Error */}
      {!isLoading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Result card */}
      {result && isDone && view && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-black/90">
                {view.title ?? query}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <ConfidenceChip level={result.confidence} />
                <button
                  type="button"
                  onClick={() => {
                    if (isEditing) {
                      // Leaving edit mode — re-check duplicates against the
                      // possibly-changed title.
                      void checkDuplicates(view.title ?? query, view.start_date);
                    }
                    setIsEditing((v) => !v);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                    isEditing
                      ? "border-black bg-black text-white hover:bg-black/80"
                      : "border-black/[0.12] text-black/60 hover:border-black/30 hover:text-black/80"
                  }`}
                >
                  {isEditing ? "Готово" : "✎ Редактирай"}
                </button>
              </div>
            </div>

            {/* Duplicate warning — populated after the async check resolves */}
            <DuplicateWarning matches={duplicates} />

            {/* Low confidence warning */}
            {result.confidence === "low" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Ниска увереност — намерената информация може да е непълна или неточна. Провери ръчно преди изпращане.
              </div>
            )}

            {isEditing ? (
              <EditForm fields={view} onChange={applyEdit} />
            ) : (
              <>
                {/* Core fields */}
                <div className="space-y-1.5">
                  <DateRange fields={view} />
                  <LocationLine fields={view} />
                  <OrganizerLine fields={view} />
                  <FieldRow label="Вход" value={typeof view.is_free === "boolean" ? view.is_free : null} />
                  <FieldRow label="Категория" value={view.category} />
                  {view.tags.length > 0 && <FieldRow label="Тагове" value={view.tags} />}
                </div>

                {/* Description */}
                {view.description && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-black/35">Описание</p>
                    <p className="text-sm text-black/70 leading-relaxed">{view.description}</p>
                  </div>
                )}
              </>
            )}

            {/* Hero image candidates — always rendered when any candidates exist,
                even if all <img> tags fail to load in the browser. Broken thumbs
                still show the URL so admin knows what was discovered (CORS / 403
                in the browser doesn't mean the server-side rehost will fail). */}
            {result.fields.hero_image_candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-black/35">
                  Снимки ({result.fields.hero_image_candidates.length})
                  {result.fields.hero_image_candidates.length > 1 && " — избери главна"}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {result.fields.hero_image_candidates.map((url) => {
                    const isSelected = selectedHeroImage === url;
                    const hasFailed = failedImages.has(url);
                    let host = url;
                    try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
                    return (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setSelectedHeroImage(isSelected ? null : url)}
                        title={url}
                        className={`relative overflow-hidden rounded-lg border-2 transition ${
                          isSelected
                            ? "border-[#ff4c1f] ring-2 ring-[#ff4c1f]/30"
                            : "border-black/[0.1] hover:border-black/30"
                        } ${hasFailed ? "bg-black/[0.04]" : ""}`}
                      >
                        {hasFailed ? (
                          <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 px-2 text-center">
                            <span className="text-xl text-black/30">⚠</span>
                            <span className="truncate text-[10px] text-black/40">{host}</span>
                            <span className="text-[9px] text-black/30">не зарежда в браузъра</span>
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            // Route the preview through our server-side proxy so
                            // hotlink-protected / CORS-restricted candidate URLs
                            // still render. The original URL is what's submitted
                            // to direct-create (server rehosts from the source).
                            src={`/admin/api/research-smart/image-proxy?url=${encodeURIComponent(url)}`}
                            alt=""
                            className="aspect-video w-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={() => {
                              setFailedImages((prev) => new Set(prev).add(url));
                            }}
                          />
                        )}
                        {isSelected && (
                          <span className="absolute bottom-1 right-1 rounded-md bg-[#ff4c1f] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            Главна
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-black/30">
                  Сървърът ще препрехости избраната главна снимка при добавяне — счупените thumbnails понякога работят server-side.
                </p>
              </div>
            )}

            {/* Links */}
            {!isEditing && (view.website_url || view.facebook_url || view.instagram_url || view.ticket_url) && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-black/35">Линкове</p>
                <LinkLine label="Уебсайт" url={view.website_url} />
                <LinkLine label="Facebook" url={view.facebook_url} />
                <LinkLine label="Instagram" url={view.instagram_url} />
                <LinkLine label="Билети" url={view.ticket_url} />
              </div>
            )}

            {/* Sources */}
            {result.sources.length > 0 && (
              <div className="space-y-1.5 border-t border-black/[0.06] pt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-black/35">Източници</p>
                <div className="space-y-1">
                  {result.sources.map((s) => (
                    <div key={s.url} className="flex items-center gap-2 text-xs">
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-blue-600 hover:underline"
                      >
                        {s.domain}
                      </a>
                      {s.is_ai_overview && (
                        <span className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                          AI Overview
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-black/30">
                  Доставчици: {result.providers_used.join(", ")}
                </p>
              </div>
            )}
          </div>

          {/* Add to review */}
          <div className="flex flex-col gap-2">
            {dupChecking && (
              <p className="text-center text-xs text-black/40">Проверка за дубликати...</p>
            )}
            <button
              onClick={sendToPipeline}
              disabled={isSending}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black/80 disabled:opacity-40"
            >
              {isSending ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Създавам...
                </>
              ) : (
                <>
                  Добави за преглед
                  <span className="text-white/50">→</span>
                </>
              )}
            </button>
            {sendStatus && (
              <p className="text-center text-xs text-red-600">{sendStatus}</p>
            )}
          </div>

          {/* Warnings (debug) */}
          {result.warnings.length > 0 && (
            <details className="text-xs text-black/40">
              <summary className="cursor-pointer select-none">Предупреждения ({result.warnings.length})</summary>
              <ul className="mt-1 space-y-0.5 pl-3">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
