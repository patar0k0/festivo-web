# Festivo · Organizer Design System

> **Когато правиш промени по organizer pages — следвай това.**
>
> Документира consistent design language за всички страници в `/organizer/*`. Цел: всеки нов screen да изглежда и работи както останалите без да трябва инжинерът да изобретява patterns наново.

Last updated: 23 май 2026 (след PR #372–#389).

---

## 1. Принципи

| # | Принцип |
|---|---|
| 1 | **Един визуален език** — amber gradient cards, brand red `#7c2d12`, sentence case, emoji icons вместо SVG. |
| 2 | **Workspace consistency** — всички authenticated organizer-task pages са в `(workspace)` route group → автоматично получават topbar + sidebar nav. |
| 3 | **Не дублирай navigation** — workspace pages нямат public `SiteHeader/Footer` (виж `ConditionalSiteChrome`). |
| 4 | **Bulgarian first** — UI на български. Емейл копи на български. Само DB slugs/categories може да са в Latin (server-normalized). |
| 5 | **Auto-detect role** — non-organizer users виждат marketing & onboarding; active organizers получават workspace shell automatically. |
| 6 | **Прогресивно разкритие** — onboarding hints (промоция nudge, draft badge) се показват **само ако са релевантни** за текущото състояние на user-а. |

---

## 2. Палитра

### Основни брандови

| Цвят | Hex | Употреба |
|---|---|---|
| Brand red (primary) | `#7c2d12` | CTA бутони, active sidebar item, eyebrows, accent borders |
| Brand red (hover) | `#5c200d` | Hover state на primary бутони |
| Brand red (light) | `#fef3e2` | Soft icon backgrounds, code highlight |
| Ink | `#0c0e14` | Основен text color |
| Card background | `#fafaf8` | Subtle section backgrounds |
| Amber 50/55-200/65 (tints) | tailwind | Cards, borders, ring-1, gradients |

### Status colors

| State | Tone | Класове |
|---|---|---|
| Pending / waiting | Amber | `border-amber-200/80 bg-amber-50/90 text-amber-900` + `bg-amber-500` dot |
| Approved / success | Emerald | `border-emerald-200/80 bg-emerald-50/90 text-emerald-900` + `bg-emerald-500` dot |
| Rejected / error | Red | `border-red-200/80 bg-red-50/90 text-red-900` + `bg-red-500` dot |
| Draft / neutral | Neutral | `border-black/[0.12] bg-white text-black/70` + `bg-black/30` dot |

---

## 3. Layout & Chrome

### Workspace shell (`(workspace)` route group)

Всички pages вътре в `app/organizer/(workspace)/` автоматично получават:

- **Topbar** (`WorkspaceShell.tsx`):
  - Festivo logo + breadcrumb „/ Организатори"
  - Avatar pill с инициала + email
  - „← Към сайта" + „Изход" buttons (secondary)
  - Sticky top, white/blur background
- **Sidebar** (`OrganizerSidebarNav.tsx`):
  - Sentence case labels с emoji icons
  - Amber active state (`bg-amber-50/70 ring-1 ring-amber-100/50`)
  - Draft count badge на „Моите подавания" когато > 0
  - „Помощ" section с `admin@festivo.bg`
- **Main content** wrapper: `max-w-3xl` centered

### Извън workspace (marketing/onboarding)

| Route | Chrome | Защо |
|---|---|---|
| `/organizer` | Public | Marketing landing — достъпен от public nav |
| `/organizer/benefits` | Public | Info page |
| `/organizer/claim` | Public | Onboarding — потребителят още не е „вътре" |
| `/organizer/profile/new` | Public | Onboarding |

Гейтиране: `components/ConditionalSiteChrome.tsx` (function `isInternalWorkspaceRoute`).

---

## 4. Page header pattern

Всяка workspace page започва с **същата 3-частова структура**:

```tsx
<div className="space-y-6">
  {/* 1. Back link */}
  <Link
    href="/organizer/dashboard"
    className="inline-flex items-center gap-1.5 rounded-sm text-xs font-semibold uppercase tracking-[0.14em] text-black/55 transition-colors hover:text-[#0c0e14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25"
  >
    <span aria-hidden="true">←</span> Назад към таблото
  </Link>

  {/* 2. Amber gradient hero card */}
  <header className="rounded-2xl border border-amber-200/55 bg-gradient-to-br from-amber-50/55 via-white to-white/95 p-5 shadow-sm ring-1 ring-amber-100/40 sm:p-7">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c2d12]">
      Eyebrow text
    </p>
    <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold tracking-tight text-[#0c0e14] md:text-3xl">
      Page title
    </h1>
    <p className="mt-2 max-w-prose text-sm leading-relaxed text-black/65">
      Lead paragraph — какво прави страницата, какво да очаква user-ът.
    </p>
  </header>

  {/* 3. Main content (sections, forms, lists, …) */}
</div>
```

Примери: `/dashboard`, `/submissions`, `/festivals/new`, `/organizations/[id]/edit`.

---

## 5. Form inputs

Tokens (дефинирани inline в всеки page):

```ts
const FIELD_CLASS =
  "w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2.5 text-sm text-[#0c0e14] outline-none transition-all duration-150 placeholder:text-black/40 hover:border-black/20 focus-visible:border-black/15 focus-visible:ring-1 focus-visible:ring-[#7c2d12]/25";

const LABEL_TEXT_CLASS = "block text-sm font-medium text-[#0c0e14] mb-1.5";

const HELPER_CLASS = "mt-1 text-[11px] text-black/55";
```

### Required marker

Червена звездичка след label-а: `<span className="text-[#7c2d12]">*</span>`.

### Character counter

Под input-а, дясно подравнено. Warning state при ≥85% от max:

```tsx
<div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-black/45">
  <span>Helper text</span>
  <span className={value.length > MAX * 0.85 ? "text-amber-700" : ""}>
    {value.length}/{MAX}
  </span>
</div>
```

### Date & time

- **Date**: native `<input type="date">` с `min="2024-01-01" max="2030-12-31"` (предотвратява typo-та). Helper „Натисни иконата 📅 за календар."
- **Time**: `<input type="text">` + `inputMode="numeric"` + `pattern="[0-2][0-9]:[0-5][0-9]"` + placeholder „напр. 18:30". **Никога не използвай `type="time"`** — Chrome в EN locale показва AM/PM picker.

### Category / combo

Combo (free text + suggestions): `<input list="…">` + `<datalist>` с опции от DB (`festivals.category` sorted by usage, fallback list).

```tsx
<input list="organizer-category-suggestions" ... />
<datalist id="organizer-category-suggestions">
  {categorySuggestions.map((c) => <option key={c} value={c} />)}
</datalist>
```

---

## 6. Buttons

### Primary (brand)

```tsx
<button className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#7c2d12] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#5c200d] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25 disabled:cursor-not-allowed disabled:opacity-50">
  Primary CTA →
</button>
```

### Secondary (ghost)

```tsx
<button className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/[0.12] bg-white px-5 py-2.5 text-sm font-medium text-[#0c0e14] transition hover:bg-black/[0.04]">
  Secondary
</button>
```

### Submit с loading

```tsx
{busy ? (
  <>
    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
    Изпращане…
  </>
) : (
  <>Запази →</>
)}
```

### Onboarding nudge (primary override)

Когато потребителят няма submissions, „Добави фестивал" в sidebar получава brand red треатмент като primary CTA (вижда се по-видимо отколкото останалите links). След първа submission се връща normalно.

---

## 7. Cards & sections

### Section card

`border-black/[0.06] bg-white/95 p-5 md:p-7 shadow-sm rounded-2xl`

### Empty state card

```tsx
<div className="rounded-xl border border-dashed border-amber-300/55 bg-[#fefcf8] px-5 py-8 text-center">
  <p className="text-3xl">📅</p>
  <p className="mt-2 text-sm font-semibold text-[#0c0e14]">Все още няма X</p>
  <p className="mx-auto mt-1 max-w-sm text-xs text-black/55">Обяснение защо да добави.</p>
  <button className="mt-4 bg-[#7c2d12] …">+ Добави първи</button>
</div>
```

### Info box (tip)

```tsx
<div className="rounded-xl border border-amber-200/45 bg-amber-50/35 px-4 py-3 text-xs leading-relaxed text-[#5c200d]/90">
  💡 Tip съдържание.
</div>
```

### Stat chip (count card)

Виж `app/organizer/(workspace)/submissions/page.tsx` за `StatChip` reference.

---

## 8. Status badges

```tsx
<span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}>
  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`} />
  {meta.label}
</span>
```

Status meta: виж `statusMeta()` в submissions/page.tsx.

---

## 9. File uploads

### Hero image (single)

- Preview tile = single click target (с „+ Качи снимка" placeholder когато празно)
- Helper text: „Натисни квадратчето вляво за да качиш снимка от компютъра си, или постави линк по-долу."
- URL input като алтернатива
- Loading spinner в tile при upload
- „Премахни снимката" link когато има стойност
- Acceptable formats: `.jpg, .png, .webp, .gif, .avif`
- Max 8 MB

### Gallery (multi)

- `multiple` file input
- Sequential upload (one HTTP request per file) — частичен успех се запазва
- Aspect-square thumbnails с hover X
- 24 file hard cap

### Storage paths

- Bucket: `festival-hero-images` (един bucket за всичко festival)
- Hero: `festival-hero/organizer/<userId>-<timestamp>-<rand>.<ext>`
- Gallery: `festival-gallery/organizer/<userId>-<timestamp>-<rand>.<ext>`

### Video

**Никога не upload-вай видео файлове** в Supabase Storage (скъпо, бавно, не оптимизирано). YouTube/Facebook URL paste е стандарт.

---

## 10. Wizard pattern (multi-step forms)

Виж `app/organizer/(workspace)/festivals/new/NewFestivalSubmissionClient.tsx`.

- Линеарен progression (1→2→3→4→5)
- Active step: solid `#7c2d12` background
- Done step: emerald-100 background с ✓ icon
- Visited-ahead step: amber-50 background (user е минал назад)
- Inactive: gray-50 background
- LocalStorage autosave (500ms debounce) с draft restore banner
- Server-side draft via PATCH endpoint (опционално)
- „Назад / Напред →" нав buttons
- На последна стъпка: „Преглед" secondary + „Изпрати за одобрение →" primary

---

## 11. Microcopy guidelines

- **Tone**: приятелски-професионален, на „ти". Не „Вие".
- **Action verbs**: „Добави", „Запази", „Изпрати", „Премахни", „Виж", „Открий", „Запиши се"
- **Дължини**:
  - Eyebrow: 1-3 думи UPPERCASE
  - H1: 2-5 думи
  - Lead: 1-2 изречения (≤200 chars)
  - Helper: 1 изречение (≤100 chars)
- **Помощни въпроси**: винаги с „по избор" в скоби когато не са required
- **Грешки**: ясни, action-oriented („Опитай отново", не „Възникна неочаквана грешка")
- **Successes**: с emoji когато емоционално подходящо (🎉 ✅ 📨)

---

## 12. Pluralization (Bulgarian)

Bulgarian има особености:

- 1: единствено число („1 фестивал")
- 2-4: paucal („2 фестивала", не „2 фестивали")
- 5+: many („5 фестивала", не „5 фестивалa")

За cities: „1 град", „2 града", „5 града"
За организатори: „1 организатор", „2-4 организатора", „5+ организатора"

Виж helper в `app/profile/QuickLinks.tsx` (`pluralize`).

---

## 13. A11y minimums

| Чек | Правило |
|---|---|
| Focus ring | Всеки interactive element: `focus-visible:ring-2 focus-visible:ring-[#7c2d12]/25` |
| aria-current | Active sidebar/wizard item: `aria-current="page"` или `"step"` |
| aria-label | Icon-only buttons (X close, hover X) |
| aria-hidden | Decorative emojis: `aria-hidden="true"` |
| Label associations | `<label htmlFor="…">` за всеки input |
| role="alert" | Error messages |
| role="status" | Loading / success messages |

---

## 14. Backend pattern за нови форми

При добавяне на нов field в organizer-submitted формите:

1. **DB schema** — нова колона в `pending_festivals` (миграция в `scripts/sql/`)
2. **POST endpoint** — добави в `app/api/organizer/pending-festivals/route.ts`:
   - Body type
   - Validation
   - Payload mapping
3. **PATCH endpoint** — добави в `app/api/organizer/pending-festivals/[id]/route.ts`
4. **Page loader** — добави в `page.tsx` SELECT-а
5. **Form state** — `NewFestivalFormData` + `NewFestivalDraftInitial`
6. **Wizard step** — добави render блок + step description
7. **Submit payload** — `buildPortalPayload` + двата `patchBody`

### NOT NULL gotcha

Production DB има NOT NULL констрейнт на research-pipeline columns които
manual organizer flow-ът не попълва. **Винаги подавай defaults** за:

- `source_count: 1`
- `verification_score: 0`
- `evidence_json: {}`

---

## 15. Когато добавяш нова organizer page

Checklist:

- [ ] В `app/organizer/(workspace)/...` ако е management task
- [ ] В `app/organizer/...` (outside workspace) ако е marketing/onboarding
- [ ] Back link „← Назад към таблото" горе
- [ ] Header card pattern (back/eyebrow/H1/lead)
- [ ] Использвай `FIELD_CLASS / LABEL_TEXT_CLASS / HELPER_CLASS`
- [ ] Brand color `#7c2d12` за primary CTAs
- [ ] Amber gradient за info/onboarding cards
- [ ] Emerald gradient за success states
- [ ] Mobile-first (sm: и md: breakpoints)
- [ ] Если new route → потенциално add to `ConditionalSiteChrome.isInternalWorkspaceRoute`
- [ ] aria-* attributes (focus rings, current step, hidden decoratives)
- [ ] Bulgarian copy с right plural forms
- [ ] Loading spinner при busy state
- [ ] Disable state with `disabled:opacity-50 disabled:cursor-not-allowed`
- [ ] Error state с `border-red-200/80 bg-red-50/90`

---

## 16. Reference PRs

Pro UX sprint chronology — useful като примери:

| PR | Page | Pattern |
|---|---|---|
| #373 | `/organizer` | Marketing landing с hero / benefits / FAQ |
| #374 | `/organizer/profile/new` | Onboarding с live preview |
| #376 | `/organizer/claim` | Two-column claim form |
| #377 | `/organizer/dashboard` | Stats + checklist + lists |
| #378 | `/organizer/festivals/new` | 5-step wizard |
| #380 | `/organizer/submissions` | Status badges + filters |
| #381 | Workspace shell + sidebar | Topbar logo + amber sidebar |
| #383 | ConditionalSiteChrome | Hide public chrome in workspace |
| #389 | `/organizations/[id]/edit` | Header redesign + workspace move |

---

## Maintenance

- **Когато добавиш нов pattern** който се повтаря в 3+ места → документирай го тук + рассмотри extract в shared token file (`lib/organizer-ui/styles.ts` като extension на `lib/public-ui/styles.ts`).
- **Когато промениш цвят/spacing** → обнови палитрата по-горе.
- **Когато добавиш нов NOT NULL column** в `pending_festivals` → добави към section 14.
