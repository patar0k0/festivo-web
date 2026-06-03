# Pending Festival Edit — Design & Code Quality Parity Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привеждане на `/admin/pending-festivals/[id]` към същото визуално и техническо ниво като вече подобрената `/admin/festivals/[id]` страница.

**Architecture:** Промените са в два файла — `app/admin/(protected)/pending-festivals/[id]/page.tsx` (server, data fetching) и `components/admin/PendingFestivalEditForm.tsx` (client, 2469 реда). Никакви schema, API или route промени не са нужни.

**Tech Stack:** Next.js 14 App Router · React · TypeScript · Tailwind · Supabase · Sonner toast

---

## Референтни файлове

| Файл | Роля |
|------|------|
| `app/admin/(protected)/pending-festivals/[id]/page.tsx` | Server page — data fetching |
| `components/admin/PendingFestivalEditForm.tsx` | Client form (2469 реда) |
| `app/admin/(protected)/festivals/[id]/page.tsx` | ✅ Вече подобрен — reference |
| `components/admin/FestivalEditForm.tsx` | ✅ Вече подобрен — reference |
| `components/admin/hooks/useFestivalMediaOps.ts` | ✅ Вече създаден hook |
| `lib/admin/entitySchema.ts` | `ADMIN_FIELD_LABEL`, `buildStandardSummaryStripItems` |

---

## Разлики между двете форми

| Аспект | FestivalEditForm (✅) | PendingFestivalEditForm (🔧) |
|--------|---------------------|---------------------------|
| Summary strip | 3 items | 6 items |
| Bottom toolbar primary | Save (dark) | Approve (dark) — различна семантика |
| Bottom toolbar destructive | Delete → вляво, 2-step | Reject → вляво, визуално amber/warning |
| Бутон labels | Български | English |
| Gallery aspect ratio | 4/3 | square (трябва промяна) |
| Location placeholder | ✅ | ❌ липсва |
| `saving` flag name | `savingForm` | `saving` (стар стил) |
| `beforeunload` guard | ✅ | ❌ липсва |
| console.info logs | премахнати | 6+ места |
| DB заявки | Promise.allSettled | последователни |
| Error catch в onSave | `e.message` | ? (трябва проверка) |
| Slug regenerate warning | amber warning | ? (трябва проверка) |

---

## Задача 1 — page.tsx: паралелни заявки

**Файлове:**
- Modify: `app/admin/(protected)/pending-festivals/[id]/page.tsx`

**Текущо:** organizers (ред 83), ingestJob (ред 103), categories (ред 121) — три последователни await.

**Цел:** `Promise.allSettled` за organizers + ingestJob + categories едновременно след главната заявка.

- [ ] Замени трите последователни await с `Promise.allSettled([organizersQuery, ingestJobQuery, categoriesQuery])`
- [ ] Запази условността на ingestJob (само ако `sourceUrlForIngest` е непразен — подай `null`-returning promise ако е празен)
- [ ] Извличай резултатите чрез `.status === "fulfilled"` checks
- [ ] Провери TypeScript: `npx tsc --noEmit`

**Код за Promise.allSettled:**
```ts
const [organizersResult, ingestJobResult, categoriesResult] = await Promise.allSettled([
  serviceSupabase
    .from("organizers")
    .select("id,name,slug,plan,plan_started_at,plan_expires_at")
    .eq("is_active", true)
    .order("name", { ascending: true, nullsFirst: false }),
  sourceUrlForIngest
    ? serviceSupabase
        .from("ingest_jobs")
        .select("status,fb_browser_context,finished_at")
        .eq("source_url", sourceUrlForIngest)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null }),
  listAllFestivalCategories(),
]);

const organizers =
  organizersResult.status === "fulfilled" && !organizersResult.value.error
    ? (organizersResult.value.data ?? []) as Pick<OrganizerProfile, "id" | "name" | "slug">[]
    : [];

let lastIngestJobMeta: { status: string; fb_browser_context: "authenticated" | "anonymous" | null; finished_at: string | null } | null = null;
if (ingestJobResult.status === "fulfilled" && !ingestJobResult.value.error && ingestJobResult.value.data) {
  const ingestJob = ingestJobResult.value.data;
  if (typeof ingestJob.status === "string") {
    const fb = ingestJob.fb_browser_context;
    lastIngestJobMeta = {
      status: ingestJob.status,
      fb_browser_context: fb === "authenticated" || fb === "anonymous" ? fb : null,
      finished_at: typeof ingestJob.finished_at === "string" ? ingestJob.finished_at : null,
    };
  }
}

const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
```

---

## Задача 2 — Summary strip: 3 items

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx` (ред ~1293)

**Текущо:** `buildStandardSummaryStripItems` с 6 полета.

**Цел:** Същия pattern като FestivalEditForm — само status, startDate, organizer.

- [ ] Замени `summaryItems` useMemo с:
```tsx
const summaryItems = useMemo(
  () => [
    { label: ADMIN_FIELD_LABEL.status, value: form.status || "—" },
    { label: ADMIN_FIELD_LABEL.startDate, value: form.start_date.trim() || "—" },
    { label: ADMIN_FIELD_LABEL.organizer, value: summaryOrganizer },
  ],
  [form.status, form.start_date, summaryOrganizer],
);
```
- [ ] Премахни `buildStandardSummaryStripItems` от импортите (провери дали се ползва другаде в същия файл)

---

## Задача 3 — Bottom toolbar: визуална йерархия + БГ labels

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx` (ред ~2424)

**Текущо:** Back | OpenSecondary | Reject | Approve | Save — всичко вдясно, всичко еднакъв стил.

**Цел:** Reject вляво (amber/warning стил, изолиран), вдясно: Back | OpenSecondary | Save | Approve (primary, зелено).

Семантика за pending-festivals:
- **Reject** = отхвърляне на кандидатурата → amber warning (не червено като Delete)
- **Approve** = primary positive action → зелен/dark акцент
- **Save edits** = secondary
- **Back** = neutral link

- [ ] Замени bottom toolbar JSX:
```tsx
<div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.08] bg-white/95 backdrop-blur">
  <div className="mx-auto flex w-full max-w-[1200px] items-center px-4 py-2.5 md:px-6">
    {/* Reject — isolated left */}
    <button
      type="button"
      onClick={() => runDecision("reject")}
      disabled={savingForm || Boolean(runningAction)}
      className="mr-auto rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 disabled:opacity-50"
    >
      {runningAction === "reject" ? "Отхвърляне..." : "Отхвърли"}
    </button>
    {/* Secondary + primary */}
    <div className="flex items-center gap-2">
      <Link href="/admin/pending-festivals" className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
        Назад
      </Link>
      <FestivalEditorOpenSecondary
        action={editorOpenAction}
        dimmed={savingForm || Boolean(runningAction) || removingHeroImage || galleryOpsBusy || extraVideoBusy}
      />
      <button
        type="submit"
        disabled={Boolean(runningAction) || savingForm || galleryOpsBusy || extraVideoBusy}
        className="rounded-xl border border-black/[0.1] bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:opacity-50"
      >
        {savingForm ? "Запис..." : "Запази промените"}
      </button>
      <button
        type="button"
        onClick={() => runDecision("approve")}
        disabled={savingForm || Boolean(runningAction)}
        className="rounded-xl bg-[#0c0e14] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white disabled:opacity-50"
      >
        {runningAction === "approve" ? "Одобряване..." : "Одобри"}
      </button>
    </div>
  </div>
</div>
```
- [ ] Обнови и top summary strip бутоните (Back, Save edits) с БГ labels (ред ~1343)

---

## Задача 4 — Gallery: aspect-[4/3]

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx`

Намери всички `aspect-square` в gallery grid и замени с `aspect-[4/3]`.

- [ ] `grep -n "aspect-square"` в PendingFestivalEditForm.tsx
- [ ] Замени с `aspect-[4/3]` (включително upload бутона)

---

## Задача 5 — Location: placeholder когато няма координати

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx`

Намери map iframe секцията (buildGoogleMapsEmbedSrc pattern) и добави placeholder:

- [ ] Намери `buildGoogleMapsEmbedSrc` извикването
- [ ] Замени `return mapEmbedPreview ? <iframe ... /> : null` с:
```tsx
return mapEmbedPreview ? (
  <iframe ... />
) : (
  <div className="mt-3 flex h-[140px] w-full items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-black/[0.02] md:col-span-2">
    <p className="text-xs text-black/35">Попълнете координати или потърсете чрез „Намери координати", за да се покаже картата.</p>
  </div>
);
```

---

## Задача 6 — `saving` → `savingForm` + `beforeunload` guard

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx`

- [ ] `replace_all: "saving"` → `"savingForm"` (само `saving` като самостоятелна дума — внимавай за `extraGalleryBusy`, `extraVideoBusy`, `savingProgram`)
- [ ] `replace_all: "setSaving"` → `"setSavingForm"` 
- [ ] Добави `const [isDirty, setIsDirty] = useState(false);`
- [ ] В `updateField` (ако съществува) или в директните `setForm` извиквания — добави `setIsDirty(true)`
- [ ] Добави useEffect за beforeunload:
```tsx
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty) e.preventDefault();
  };
  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isDirty]);
```
- [ ] В `onSave` success: добави `setIsDirty(false);`
- [ ] Провери TypeScript: `npx tsc --noEmit`

---

## Задача 7 — Console logs премахване + onSave error message

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx`

- [ ] Намери всички `console.info(` и `console.warn(` — прегледай контекста на всеки
  - `[coords] resolved from place_id` → премахни
  - `[pending-save][client]` → премахни
  - `[maps-url] overriding existing coords` → премахни
  - `[maps] extracted place_id` → премахни
  - `[coords] source=maps-url` → премахни
  - `[coords] source=geocode` → премахни
  - `[location-cache]` warn → остави (external call error — useful)
- [ ] Провери `onSave` catch блока — ако е `catch { toast.error("...") }` без `(e)`, поправи на `catch (e) { toast.error(e instanceof Error ? e.message : "Грешка при запис"); }`

---

## Задача 8 — Slug генериране: amber warning при overwrite

**Файлове:**
- Modify: `components/admin/PendingFestivalEditForm.tsx`

- [ ] Намери slug input секцията
- [ ] Приложи същия pattern от FestivalEditForm: бутонът е винаги видим когато `form.title.trim()`, amber стил когато `form.slug.trim()` вече съществува, tooltip с предупреждение:
```tsx
{form.title.trim() && (
  <button
    type="button"
    onClick={() => updateField("slug", transliteratedSlug(form.title))}
    title={form.slug.trim() ? "Внимание: регенерирането чупи съществуващи URL адреси" : undefined}
    className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
      form.slug.trim()
        ? "border-amber-300/70 bg-amber-50 text-amber-800 hover:bg-amber-100"
        : "border-black/[0.12] bg-white hover:bg-black/[0.03]"
    }`}
  >
    Генерирай
  </button>
)}
```

---

## Задача 9 — Commit и PR

- [ ] `git checkout -b style/pending-festival-edit-parity`
- [ ] `git add app/admin/\(protected\)/pending-festivals/\[id\]/page.tsx components/admin/PendingFestivalEditForm.tsx`
- [ ] Commit:
```
style(admin): pending-festival edit parity with festival edit page

- Summary strip: 3 items (status, date, organizer) matching FestivalEditForm
- Bottom toolbar: Reject isolated left (amber), Approve primary right, Bulgarian labels
- Gallery: aspect-[4/3] landscape ratio
- Location: placeholder when no coordinates
- saving → savingForm, isDirty + beforeunload guard
- Remove noisy console.info logs
- onSave catch(e) shows real error message
- Slug regenerate: amber warning when overwriting existing slug
- page.tsx: Promise.allSettled for organizers + ingestJob + categories
```
- [ ] `git push -u origin style/pending-festival-edit-parity`
- [ ] `gh pr create --title "..." --body "..."` 
- [ ] `gh pr merge --merge --delete-branch`

---

## Бележки

- `uploadingHeroImage` и `importingHeroFromUrl` са **hardcoded `false`** (редове 539-540) — те са placeholders за бъдеща функционалност. Не ги трогай.
- `runningAction` остава непроменен — семантиката е различна от `actionPending` в FestivalEditForm.
- `extraGalleryBusy`, `extraVideoBusy` — специфични за pending, запазват имената.
- Pending gallery е `string[]` (URLs), не `PublishedMediaRow[]` — `useFestivalMediaOps` hook **не се прилага** тук.
