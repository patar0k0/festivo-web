# Smart Research Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Умно търсене" tab to `/admin/research` that runs a unified SerpAPI + Perplexity (fallback) + Gemini pipeline and returns a fully-structured festival result in one click.

**Architecture:** SerpAPI is called twice in parallel (EN for AI Overview, BG for organic results). If quality is poor (<3 `.bg` domains and no AI Overview), Perplexity runs as fallback. All collected evidence is passed to Gemini for a single structured extraction call. The result is shown in a clean card with fields + sources, and can be sent to the ingest pipeline.

**Tech Stack:** Next.js 14 App Router · TypeScript · SerpAPI (`SERPAPI_KEY`) · Perplexity (`PERPLEXITY_API_KEY`) · Gemini (`GEMINI_API_KEY`) · Tailwind · existing `@/lib/admin/research/gemini-extract` + `@/lib/research/perplexity`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/research/serpApiSearch.ts` | SerpAPI calls: AI Overview + organic results |
| Create | `lib/admin/research/smart-pipeline.ts` | Core pipeline logic + types |
| Create | `app/admin/api/research-smart/route.ts` | POST endpoint — auth + calls pipeline |
| Create | `components/admin/SmartResearchPanel.tsx` | UI: input, loading, result card, send to pipeline |
| Create | `components/admin/ResearchPageTabs.tsx` | Tab switcher (client component) |
| Modify | `app/admin/(protected)/research/page.tsx` | Render `ResearchPageTabs` instead of direct panel |

---

## Task 1: SerpAPI search helper

**Files:**
- Create: `lib/research/serpApiSearch.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/research/serpApiSearch.ts
import "server-only";

export type SerpApiOrganicHit = {
  url: string;
  title: string | null;
  snippet: string | null;
};

type AiOverviewBlock = {
  type: string;
  text?: string;
  items?: unknown[];
};

type SerpApiRawResponse = {
  ai_overview?: {
    text_blocks?: AiOverviewBlock[];
    page_token?: string;
  };
  organic_results?: Array<{ link?: string; title?: string; snippet?: string }>;
  error?: string;
};

export type SerpApiSearchResult = {
  ai_overview_text: string | null;
  organic: SerpApiOrganicHit[];
};

function blocksToText(blocks: AiOverviewBlock[]): string {
  const lines: string[] = [];
  for (const b of blocks) {
    if (typeof b.text === "string" && b.text.trim()) lines.push(b.text.trim());
    if (Array.isArray(b.items)) {
      for (const item of b.items) {
        if (typeof item === "string" && item.trim()) lines.push(`- ${item.trim()}`);
        if (item && typeof item === "object" && "text" in item && typeof (item as { text?: string }).text === "string") {
          const t = ((item as { text: string }).text).trim();
          if (t) lines.push(`- ${t}`);
        }
      }
    }
  }
  return lines.join("\n");
}

async function fetchSerpApi(params: Record<string, string>): Promise<SerpApiRawResponse> {
  const url = new URL("https://serpapi.com/search.json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return {};
  return (await res.json()) as SerpApiRawResponse;
}

export async function serpApiSearch(query: string, hl: "en" | "bg"): Promise<SerpApiSearchResult> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) return { ai_overview_text: null, organic: [] };

  const json = await fetchSerpApi({ engine: "google", q: query, hl, gl: "bg", api_key: apiKey }).catch(
    () => ({}) as SerpApiRawResponse,
  );

  if (json.error) return { ai_overview_text: null, organic: [] };

  // AI Overview — may need a follow-up page_token request
  let ai_overview_text: string | null = null;
  const blocks = json.ai_overview?.text_blocks;
  if (blocks && blocks.length > 0) {
    const text = blocksToText(blocks);
    if (text) ai_overview_text = text;
  }
  if (!ai_overview_text && json.ai_overview?.page_token) {
    try {
      const json2 = await fetchSerpApi({ engine: "google", page_token: json.ai_overview.page_token, api_key: apiKey });
      const blocks2 = json2.ai_overview?.text_blocks;
      if (blocks2 && blocks2.length > 0) {
        const text = blocksToText(blocks2);
        if (text) ai_overview_text = text;
      }
    } catch {
      // ignore follow-up failure
    }
  }

  // Organic results
  const organic: SerpApiOrganicHit[] = (json.organic_results ?? [])
    .map((r) => ({
      url: (r.link ?? "").trim(),
      title: typeof r.title === "string" ? r.title.trim() : null,
      snippet: typeof r.snippet === "string" ? r.snippet.trim() : null,
    }))
    .filter((r) => r.url.startsWith("http"));

  return { ai_overview_text, organic };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep serpApiSearch
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/smart-research-panel
git add lib/research/serpApiSearch.ts
git commit -m "feat(admin): add SerpAPI search helper with AI Overview support"
```

---

## Task 2: Smart pipeline core

**Files:**
- Create: `lib/admin/research/smart-pipeline.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/admin/research/smart-pipeline.ts
import "server-only";
import { serpApiSearch } from "@/lib/research/serpApiSearch";
import { researchFestival } from "@/lib/research/perplexity";
import { extractFestivalFieldsFromEvidence } from "@/lib/admin/research/gemini-extract";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { programDraftFromGeminiProgram } from "@/lib/festival/programDraft";
import type { ProgramDraft } from "@/lib/festival/programDraft";

export type SmartResearchSource = {
  url: string;
  title: string | null;
  domain: string;
  snippet: string | null;
  is_ai_overview: boolean;
};

export type SmartResearchFields = {
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  city: string | null;
  location_name: string | null;
  address: string | null;
  organizer_name: string | null;
  organizer_names: string[] | null;
  description: string | null;
  is_free: boolean | null;
  category: string | null;
  tags: string[];
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  ticket_url: string | null;
  hero_image: string | null;
  program_draft: ProgramDraft | null;
};

export type SmartResearchResult = {
  fields: SmartResearchFields;
  sources: SmartResearchSource[];
  confidence: "high" | "medium" | "low";
  providers_used: string[];
  warnings: string[];
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function domainFrom(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function confidenceLevel(fields: SmartResearchFields, sourcesCount: number): "high" | "medium" | "low" {
  const filled = [fields.title, fields.start_date, fields.city, fields.organizer_name].filter(Boolean).length;
  if (filled >= 3 && sourcesCount >= 2) return "high";
  if (filled >= 2) return "medium";
  return "low";
}

export async function runSmartResearchPipeline(query: string): Promise<SmartResearchResult> {
  if (!isGeminiConfigured()) throw new Error("GEMINI_API_KEY is not configured");

  const warnings: string[] = [];
  const providers_used: string[] = ["serpapi"];

  // Step 1: parallel SerpAPI calls (EN for AI Overview, BG for organic results)
  const [enResult, bgResult] = await Promise.all([
    serpApiSearch(query, "en").catch(() => ({ ai_overview_text: null, organic: [] })),
    serpApiSearch(query, "bg").catch(() => ({ ai_overview_text: null, organic: [] })),
  ]);

  const aiOverviewText = enResult.ai_overview_text;
  const organic = bgResult.organic;

  // Step 2: quality check — Perplexity fallback when results are thin
  const bgDomainCount = organic.filter((r) => r.url.toLowerCase().includes(".bg")).length;
  const hasGoodResults = Boolean(aiOverviewText) || bgDomainCount >= 3;

  let perplexityContext: string | null = null;
  if (!hasGoodResults && process.env.PERPLEXITY_API_KEY?.trim()) {
    try {
      const pr = await researchFestival(query);
      const parts: string[] = [];
      if (pr.title) parts.push(`Заглавие: ${pr.title}`);
      if (pr.start_date) parts.push(`Начална дата: ${pr.start_date}`);
      if (pr.end_date) parts.push(`Крайна дата: ${pr.end_date}`);
      if (pr.city) parts.push(`Град: ${pr.city}`);
      if (pr.location_name) parts.push(`Място: ${pr.location_name}`);
      if (pr.organizer_name) parts.push(`Организатор: ${pr.organizer_name}`);
      if (pr.description) parts.push(`Описание: ${pr.description.slice(0, 800)}`);
      if (parts.length > 0) {
        perplexityContext = parts.join("\n");
        providers_used.push("perplexity");
      }
    } catch (e) {
      warnings.push(`Perplexity fallback failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Step 3: build combined evidence for Gemini
  const evidenceParts: string[] = [];
  if (aiOverviewText) {
    evidenceParts.push(`=== Google AI Overview ===\n${aiOverviewText}`);
  }
  for (const r of organic.slice(0, 5)) {
    if (r.snippet) {
      evidenceParts.push(`=== ${r.title ?? r.url} (${r.url}) ===\n${r.snippet}`);
    }
  }
  if (perplexityContext) {
    evidenceParts.push(`=== Perplexity Research ===\n${perplexityContext}`);
  }
  const combinedEvidence = evidenceParts.join("\n\n");

  // Step 4: single Gemini extraction call
  let extraction = null;
  if (combinedEvidence.trim()) {
    try {
      extraction = await extractFestivalFieldsFromEvidence({
        userQuery: query,
        sourceUrl: "combined-smart-research",
        pageTitle: query,
        excerpt: combinedEvidence,
      });
      providers_used.push("gemini");
    } catch (e) {
      warnings.push(`Gemini extraction failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    warnings.push("No evidence collected from any provider.");
  }

  // Step 5: build sources list
  const sources: SmartResearchSource[] = [];
  if (aiOverviewText) {
    sources.push({
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      title: "Google AI Overview",
      domain: "google.com",
      snippet: aiOverviewText.slice(0, 300),
      is_ai_overview: true,
    });
  }
  for (const r of organic.slice(0, 6)) {
    sources.push({
      url: r.url,
      title: r.title,
      domain: domainFrom(r.url),
      snippet: r.snippet,
      is_ai_overview: false,
    });
  }

  // Step 6: assemble result
  const fields: SmartResearchFields = {
    title: str(extraction?.title),
    start_date: str(extraction?.start_date),
    end_date: str(extraction?.end_date) ?? str(extraction?.start_date),
    start_time: str(extraction?.start_time),
    end_time: str(extraction?.end_time),
    city: str(extraction?.city),
    location_name: str(extraction?.location_name),
    address: str(extraction?.address),
    organizer_name: str(extraction?.organizer_name),
    organizer_names:
      Array.isArray(extraction?.organizer_names) && extraction.organizer_names.length > 0
        ? extraction.organizer_names.map((n) => str(n)).filter((n): n is string => n !== null)
        : null,
    description: str(extraction?.description),
    is_free: typeof extraction?.is_free === "boolean" ? extraction.is_free : null,
    category: str(extraction?.category),
    tags: Array.isArray(extraction?.tags) ? (extraction.tags as string[]) : [],
    website_url: str(extraction?.website_url),
    facebook_url: str(extraction?.facebook_url),
    instagram_url: str(extraction?.instagram_url),
    ticket_url: str(extraction?.ticket_url),
    hero_image: str(extraction?.hero_image),
    program_draft: extraction?.program ? programDraftFromGeminiProgram(extraction.program) : null,
  };

  return {
    fields,
    sources,
    confidence: confidenceLevel(fields, sources.length),
    providers_used,
    warnings,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep smart-pipeline
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/research/smart-pipeline.ts
git commit -m "feat(admin): add smart research pipeline (SerpAPI + Perplexity fallback + Gemini)"
```

---

## Task 3: API route

**Files:**
- Create: `app/admin/api/research-smart/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/admin/api/research-smart/route.ts
import { NextResponse } from "next/server";
import { getAdminContext } from "@/lib/admin/isAdmin";
import { isGeminiConfigured } from "@/lib/admin/research/gemini-provider";
import { runSmartResearchPipeline } from "@/lib/admin/research/smart-pipeline";

export async function POST(request: Request) {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (!process.env.SERPAPI_KEY?.trim()) {
    return NextResponse.json({ error: "SERPAPI_KEY is not configured" }, { status: 503 });
  }
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const result = await runSmartResearchPipeline(query);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Smart research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep research-smart
```

Expected: no output.

- [ ] **Step 3: Test the endpoint manually**

```bash
curl -X POST http://localhost:3000/admin/api/research-smart \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste admin session cookie>" \
  -d '{"query":"Между три планини 2026"}'
```

Expected: `{"ok":true,"result":{"fields":{...},"sources":[...],"confidence":"...","providers_used":[...],"warnings":[]}}`

- [ ] **Step 4: Commit**

```bash
git add app/admin/api/research-smart/route.ts
git commit -m "feat(admin): add /admin/api/research-smart POST endpoint"
```

---

## Task 4: SmartResearchPanel component

**Files:**
- Create: `components/admin/SmartResearchPanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/admin/SmartResearchPanel.tsx
"use client";

import { useState } from "react";
import type { SmartResearchResult, SmartResearchFields } from "@/lib/admin/research/smart-pipeline";

type LoadingStep = "idle" | "searching" | "analyzing" | "done" | "error";

const STEP_LABELS: Record<LoadingStep, string> = {
  idle: "",
  searching: "Търся в Google...",
  analyzing: "Анализирам с Gemini...",
  done: "",
  error: "",
};

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

function DateRange({ fields }: { fields: SmartResearchFields }) {
  const { start_date, end_date, start_time, end_time } = fields;
  if (!start_date) return null;

  let dateStr = start_date;
  if (end_date && end_date !== start_date) dateStr = `${start_date} – ${end_date}`;

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
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<LoadingStep>("idle");
  const [result, setResult] = useState<SmartResearchResult | null>(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState("");

  const isLoading = step === "searching" || step === "analyzing";

  const runResearch = async () => {
    if (!query.trim() || isLoading) return;
    setError("");
    setResult(null);
    setSendStatus("");
    setStep("searching");

    // Simulate step transitions for UX
    const analyzeTimer = setTimeout(() => setStep("analyzing"), 3_000);

    try {
      const res = await fetch("/admin/api/research-smart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; result?: SmartResearchResult; error?: string } | null;
      clearTimeout(analyzeTimer);

      if (!res.ok || !payload?.result) {
        throw new Error(payload?.error ?? "Заявката неуспешна.");
      }
      setResult(payload.result);
      setStep("done");
    } catch (e) {
      clearTimeout(analyzeTimer);
      setError(e instanceof Error ? e.message : "Неочаквана грешка.");
      setStep("error");
    }
  };

  const sendToPipeline = async () => {
    if (!result) return;
    setIsSending(true);
    setSendStatus("");
    try {
      const { fields, sources, confidence } = result;
      const ai_result = {
        title: fields.title,
        description: fields.description,
        category: fields.category,
        start_date: fields.start_date,
        end_date: fields.end_date,
        city: fields.city,
        location_name: fields.location_name,
        address: fields.address,
        organizer_name: fields.organizer_name,
        organizer_names: fields.organizer_names,
        website_url: fields.website_url,
        facebook_url: fields.facebook_url,
        instagram_url: fields.instagram_url,
        ticket_url: fields.ticket_url,
        hero_image: fields.hero_image,
        is_free: fields.is_free,
        program_draft: fields.program_draft,
        source_urls: sources.filter((s) => !s.is_ai_overview).map((s) => s.url),
        confidence,
        missing_fields: [],
      };

      const res = await fetch("/admin/api/ingest-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_type: "research", ai_result }),
      });
      const payload = (await res.json().catch(() => null)) as { job_id?: string; id?: string; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error ?? "Неуспешно изпращане.");
      const jobId = payload?.job_id ?? payload?.id;
      setSendStatus(`✓ Изпратено — job ${jobId}. Работникът ще създаде pending фестивал.`);
    } catch (e) {
      setSendStatus(`Грешка: ${e instanceof Error ? e.message : "Неочаквана грешка."}`);
    } finally {
      setIsSending(false);
    }
  };

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

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-3 text-sm text-black/50">
          <span className="size-4 animate-spin rounded-full border-2 border-black/20 border-t-black/60" />
          {STEP_LABELS[step]}
        </div>
      )}

      {/* Error */}
      {step === "error" && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Result card */}
      {result && step === "done" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-sm space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-black/90">
                {result.fields.title ?? query}
              </h2>
              <ConfidenceChip level={result.confidence} />
            </div>

            {/* Low confidence warning */}
            {result.confidence === "low" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                Ниска увереност — намерената информация може да е непълна или неточна. Провери ръчно преди изпращане.
              </div>
            )}

            {/* Core fields */}
            <div className="space-y-1.5">
              <DateRange fields={result.fields} />
              <LocationLine fields={result.fields} />
              <OrganizerLine fields={result.fields} />
              <FieldRow label="Вход" value={typeof result.fields.is_free === "boolean" ? result.fields.is_free : null} />
              <FieldRow label="Категория" value={result.fields.category} />
              {result.fields.tags.length > 0 && <FieldRow label="Тагове" value={result.fields.tags} />}
            </div>

            {/* Description */}
            {result.fields.description && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-black/35">Описание</p>
                <p className="text-sm text-black/70 leading-relaxed">{result.fields.description}</p>
              </div>
            )}

            {/* Links */}
            {(result.fields.website_url || result.fields.facebook_url || result.fields.instagram_url || result.fields.ticket_url) && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-black/35">Линкове</p>
                <LinkLine label="Уебсайт" url={result.fields.website_url} />
                <LinkLine label="Facebook" url={result.fields.facebook_url} />
                <LinkLine label="Instagram" url={result.fields.instagram_url} />
                <LinkLine label="Билети" url={result.fields.ticket_url} />
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

          {/* Send to pipeline */}
          <div className="flex items-center gap-3">
            <button
              onClick={sendToPipeline}
              disabled={isSending}
              className="rounded-xl border border-black/15 bg-white px-5 py-2.5 text-sm font-medium text-black/80 shadow-sm transition hover:bg-black/[0.03] disabled:opacity-40"
            >
              {isSending ? "Изпращане..." : "Изпрати в pipeline →"}
            </button>
            {sendStatus && <p className="text-sm text-black/60">{sendStatus}</p>}
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | grep SmartResearch
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/admin/SmartResearchPanel.tsx
git commit -m "feat(admin): add SmartResearchPanel component"
```

---

## Task 5: Tab integration on /admin/research

**Files:**
- Create: `components/admin/ResearchPageTabs.tsx`
- Modify: `app/admin/(protected)/research/page.tsx`

- [ ] **Step 1: Create the tab wrapper component**

```typescript
// components/admin/ResearchPageTabs.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import SmartResearchPanel from "@/components/admin/SmartResearchPanel";
import ResearchFestivalPanel from "@/components/admin/ResearchFestivalPanel";

type Tab = "smart" | "classic";

function Tabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const active: Tab = (searchParams.get("tab") as Tab) === "classic" ? "classic" : "smart";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b border-black/[0.08] mb-6">
        <div className="flex gap-1 px-1">
          <button
            onClick={() => setTab("smart")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === "smart"
                ? "border-black text-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            ✨ Умно търсене
          </button>
          <button
            onClick={() => setTab("classic")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === "classic"
                ? "border-black text-black"
                : "border-transparent text-black/40 hover:text-black/70"
            }`}
          >
            Класическо
          </button>
        </div>
      </div>

      {/* Tab content */}
      {active === "smart" ? <SmartResearchPanel /> : <ResearchFestivalPanel />}
    </div>
  );
}

export default function ResearchPageTabs() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-black/40">Зареждане...</div>}>
      <Tabs />
    </Suspense>
  );
}
```

- [ ] **Step 2: Update the research page**

Replace the entire content of `app/admin/(protected)/research/page.tsx` with:

```typescript
// app/admin/(protected)/research/page.tsx
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin/isAdmin";
import ResearchPageTabs from "@/components/admin/ResearchPageTabs";

export default async function AdminResearchPage() {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.isAdmin) {
    redirect("/login?next=/admin/research");
  }

  return <ResearchPageTabs />;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --project tsconfig.json 2>&1 | head -20
```

Expected: no output (no errors).

- [ ] **Step 4: Commit**

```bash
git add components/admin/ResearchPageTabs.tsx app/admin/\(protected\)/research/page.tsx
git commit -m "feat(admin): add tab layout to /admin/research — Умно търсене + Класическо"
```

---

## Task 6: PR, merge, deploy

- [ ] **Step 1: Push branch**

```bash
git push -u origin feat/smart-research-panel
```

- [ ] **Step 2: Open and merge PR**

```bash
gh pr create --repo patar0k0/festivo-web \
  --title "feat(admin): unified Smart Research panel with SerpAPI + Gemini" \
  --body "Adds '✨ Умно търсене' tab to /admin/research. Pipeline: SerpAPI (EN AI Overview + BG organic) → Perplexity fallback → Gemini extraction → structured result card with sources + send to pipeline."

gh pr merge --repo patar0k0/festivo-web --merge --delete-branch
```

- [ ] **Step 3: Verify production deploy**

```bash
vercel ls --scope patar0k0s-projects
```

Expected: top entry shows `● Ready`.

- [ ] **Step 4: Smoke test in browser**

1. Open `https://festivo.bg/admin/research`
2. Confirm two tabs: "✨ Умно търсене" (active) and "Класическо"
3. Type "Между три планини 2026" → click "Изследвай"
4. Confirm result card appears with at least title + city
5. Confirm sources list shows ≥1 URL
6. Click "Изпрати в pipeline →" → confirm job ID returned
