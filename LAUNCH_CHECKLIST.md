# 🚀 Festivo.bg — Launch Checklist

> **Living document.** Този файл е source of truth за launch процеса. Claude Code и Експерта го обновяват всеки път, когато статус се промени.

**Слоган:** Открий. Планирай. Посети. — Фестивалите на България на едно място.
**Target launch date:** Сряда, 28 май 2026 (ден 14 от sprint-а)
**Бюджет реклама:** до 200 лв./месец (стартира ден 21+)

---

## 📍 Текущ статус

- **Sprint ден:** 2 / 14
- **Launch стабилност:** 🟡 в подготовка
- **Блокери в момента:** —
- **Последно обновяване:** 19 май 2026

---

## 🗓 14-дневен Launch Sprint

### Седмица 1 — Технически блокери (дни 1–7)

#### Ден 1–2: Мониторинг + Pixel (НАЙ-ВАЖНОТО)

- [x] **Sentry** setup — `npm i @sentry/nextjs && npx @sentry/wizard`
> 💡 Claude Code note (18 май): Инсталиран `@sentry/nextjs`. Wizard + Vercel integration минаха успешно. DSN в env vars. Конфигурирано: `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0.0`, `replaysOnErrorSampleRate: 1.0`, `sendDefaultPii: false` (GDPR). `generateMetadata()` в `app/layout.tsx` включва `Sentry.getTraceData()` за distributed tracing.
- [ ] **Plausible** или **Umami** instalation — script tag в `layout.tsx`
- [x] **Meta Pixel** инсталиран — започва да събира data веднага
> 💡 Claude Code note (18 май): Pixel ID `1381183357170093`. `MetaPixel` компонент с `next/script strategy=afterInteractive`. Env var `NEXT_PUBLIC_META_PIXEL_ID` добавен в Vercel.
- [ ] **GA4** + Google Tag Manager — за по-късно Google Ads
- [x] **UptimeRobot** — добави festivo.bg homepage + `/api/health`
> 💡 Claude Code note (19 май): Monitor добавен на dashboard.uptimerobot.com — HTTP/S, festivo.bg, на всеки 5 мин. `/api/health` edge endpoint добавен (PR #318).
- [x] **Vercel Analytics** включен от dashboard
- [x] **Slack/Discord webhook** за критични Sentry alerts
> 💡 Claude Code note (19 май): Email alert настроен в Sentry — "A new issue is created" → Notify Suggested Assignees. Вече има и default "high priority" alert.

> ⏰ Защо първо това: мониторингът трябва да върви ПРЕДИ да има потребители. Pixel-ът има нужда от 14 дни data — стартирай го веднага.

#### Ден 3–4: SEO + Social meta

- [ ] `robots.txt` в `/public/robots.txt`
- [ ] `sitemap.xml` — автоматично през `app/sitemap.ts`
- [ ] Уникален `<title>` и `meta description` на всяка route (home, /festivals, /calendar, /map, /за-организатори, [slug])
- [ ] `canonical` URL на всяка страница
- [ ] `lang="bg"` на `<html>`
- [ ] **Schema.org `Event` JSON-LD** на festival detail (критично за Google rich results)
- [ ] **Schema.org `Organization`** на homepage
- [ ] OG картинка за homepage (1200×630)
- [ ] Динамичен OG за festival страници (`opengraph-image.tsx`)
- [ ] `og:title`, `og:description`, `og:image`, `og:url`, `og:type` на всяка страница
- [ ] Twitter Card (`twitter:card="summary_large_image"`)
- [ ] Favicons — пълен сет (16, 32, 180, 512) през realfavicongenerator.net
- [ ] `manifest.json` с цветове `#7c2d12`, `#f6f5f1`
- [ ] Регистрация в **Google Search Console** + submit sitemap
- [ ] Регистрация в **Bing Webmaster Tools**
- [ ] Тест с https://www.opengraph.xyz/

#### Ден 5: Email + сигурност

- [ ] **DKIM** запис в DNS на festivo.bg (от Resend dashboard)
- [ ] **SPF** запис в DNS
- [ ] **DMARC** запис в DNS (поне `v=DMARC1; p=none`)
- [ ] Тест в https://www.mail-tester.com/ → цел 9/10+
- [ ] Welcome email шаблон
- [x] Password reset шаблон
- [ ] Email confirmation шаблон
- [ ] Unsubscribe линк във всички marketing имейли
- [ ] **Supabase RLS** audit на всички таблици
- [ ] **CSP headers** в `next.config.js`
- [ ] `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- [ ] Всички production env vars в Vercel (нищо в git)
- [ ] Тест в https://securityheaders.com/ → цел A grade
- [ ] **CORS** на `/api/mobile/*` — само за production app domain
- [ ] Rate limiting на public endpoints (Upstash)

#### Ден 6–7: Lighthouse + полиране

- [ ] Lighthouse audit на 5 ключови страници (mobile-first): 90+ на Performance, Accessibility, SEO, Best Practices
- [ ] Image optimization (всички с `next/image`, `alt`, lazy loading)
- [ ] Font loading optimization
- [ ] Unused JS / CSS removal
- [ ] `404.tsx` и `error.tsx` стилизирани
- [ ] Loading states (`loading.tsx`) на всички routes
- [ ] Cross-browser тест: Chrome, Safari iOS, Firefox, Edge
- [ ] Real mobile тест на iPhone + Android
- [ ] `npm run build` без warnings
- [ ] `tsc --noEmit` без errors
- [ ] ESLint clean
- [ ] Health check endpoint `/api/health`
- [ ] **Supabase backups** включени (Pro план — point-in-time recovery)

---

### Седмица 2 — Съдържание + soft launch (дни 8–14)

#### Ден 8–9: Финализиране на съдържанието

- [ ] Покрий 50+ верифицирани фестивала за 2026 (текущо 65 — добре)
- [ ] Поне 10 фестивала с богато съдържание (програма, дълго описание, множество снимки)
- [ ] Покритие на категории: фолклорен, винен, гастро, градски празник, музикален, арт
- [ ] Покритие на градове: София, Пловдив, Варна, Бургас, ВТ + 10 малки населени места
- [x] Cookie banner със Supabase sync
- [x] Privacy policy на български
- [x] Terms of service на български
- [ ] Условия за организатори (отделна страница)
- [ ] DPA преглед със Supabase, Resend, Upstash
- [ ] Contact email за GDPR (`privacy@festivo.bg`)

#### Ден 10: Социални профили

- [ ] **Facebook страница Festivo.bg** — cover, bio, първи 3 поста
- [ ] **Instagram @festivo.bg** — bio, линк, първи 3 поста
- [ ] **LinkedIn** страница (B2B аудитория)
- [ ] Резервирай @festivo.bg в TikTok (без постване)
- [ ] Cover photos и bios със слогана „Открий. Планирай. Посети."
- [ ] Линк към festivo.bg във всеки профил

#### Ден 11–12: Soft launch (тих)

- [ ] Сподели сайта с **10–15 близки** (приятели, семейство, познати фестивалджии)
- [ ] **Google Form** или Typeform за feedback (5 въпроса максимум)
- [ ] Дай им **VIP early adopter access** (3 месеца безплатно)
- [ ] **Daily Sentry check** — fix всички errors в рамките на 24h
- [ ] Поправи топ 3 UX проблема от feedback
- [ ] Newsletter signup форма (footer + popup след 30 сек)

#### Ден 13: Подготовка на launch комуникация

- [ ] Reddit пост draft (на български за r/bulgaria)
- [ ] Hacker News Show HN draft (английски)
- [ ] Personal LinkedIn пост draft с историята на проекта
- [ ] FB пост draft за личен профил + страницата
- [ ] Instagram пост + story draft
- [ ] **Email шаблон за организатори** (50 имейла подготвени)
- [ ] Списък с 10 Facebook групи („Фестивали в България", „Какво да правя в София", „Любители на българския фолклор" и т.н.)
- [ ] 5 готови поста (carousels с топ фестивали) за следващите 2 седмици

#### 🚀 Ден 14: PUBLIC LAUNCH (сряда 28 май)

**Сутрин (9:00–10:00):**
- [ ] Reddit r/bulgaria пост
- [ ] LinkedIn личен пост
- [ ] FB личен пост
- [ ] Първи пост на FB страницата на Festivo.bg

**Следобед (13:00–15:00):**
- [ ] Постове в 5 Facebook групи (различен angle всяка)
- [ ] Instagram launch пост + story
- [ ] Email кампания към 50 организатора

**Вечер (18:00–20:00):**
- [ ] Hacker News Show HN (18:00 наш час = 11:00 EST)
- [ ] Втори round social engagement — отговори на коментари

> ⚠️ **НЕ пускай Meta Ads още!** Pixel-ът трябва още 7 дни data. Стартирай ads ден 21+.
> ⚠️ **НЕ launch-вай в петък/събота.** Сряда е оптимална за reach + 2 дни буфер преди уикенда.

---

## 💰 Paid acquisition (стартира след launch, ден 21+)

**Бюджет: 200 лв./месец = ~6.5 лв./ден**

### Разпределение

| Канал | Бюджет | Цел |
|---|---|---|
| Meta retargeting | 80 лв. | Хора, посетили сайта последните 30 дни |
| Meta cold interest | 60 лв. | Топ фестивал като bait, не brand campaign |
| Google Search Ads | 40 лв. | High-intent long-tail keywords |
| Boost organic posts | 20 лв. | Седмично най-добре представящ се FB пост |

### Meta Ads setup (ден 21+)

- [ ] Facebook Business Manager верифициран
- [ ] Meta Pixel инсталиран (ден 1)
- [ ] Conversions API (server-side tracking)
- [ ] Custom audience: посетители на сайта (180 дни)
- [ ] Custom audience: добавили към „Моят план"
- [ ] Custom audience: регистрирани потребители
- [ ] Lookalike audience: 1–3% от регистрираните (след 100+)
- [ ] **Retargeting кампания** (80 лв./мес) — carousel „Не пропусни следващия фестивал"
- [ ] **Cold interest кампания** (60 лв./мес) — статичен ad към топ фестивал, не homepage
- [ ] 5+ статични carousels подготвени

### Google Ads setup (ден 30+)

- [ ] Google Ads акаунт + GTM + GA4 свързани
- [ ] **Search кампания** — само long-tail keywords:
  - „фестивали в България 2026"
  - „винен фестивал [град]"
  - „фолклорен събор [регион]"
  - „събор Копривщица 2026"
  - „какво да правя този уикенд [град]"
- [ ] Negative keywords: „безплатно изтегляне", „торент", „онлайн стрийм"

### Какво НЕ правим с 200 лв./мес

- ❌ Brand awareness кампании (иска ≥500 лв.)
- ❌ Video ads (скъпи за production)
- ❌ Performance Max в Google (гори бюджета за обучение)
- ❌ TikTok Ads (минималният daily е твърде висок за БГ)
- ❌ Influencer marketing с пари → използваме barter

---

## 🆓 Free acquisition — 80% от трафика трябва да е оттук

### Facebook групи (топ ROI безплатен канал)

- [ ] „Фестивали в България"
- [ ] „Какво да правя в София този уикенд" (+ Пловдив, Варна, Бургас)
- [ ] „Любители на българския фолклор"
- [ ] „Винен туризъм в България"
- [ ] „Български традиции и обичаи"
- [ ] „Travel Bulgaria"
- [ ] „Уикенди в България"

> Тактика: 2–3 поста седмично, реална стойност (не „вижте сайта ми"), а „Този уикенд топ 3 фестивала → ето защо → пълен списък в festivo.bg".

### SEO (дългосрочно, безплатно)

- [ ] Schema.org Event markup → Google Rich Results
- [ ] Blog секция `/blog` (от месец 2):
  - „10-те най-добри фолклорни фестивала в България 2026"
  - „Винен туризъм в България: фестивали и винарни"
  - „Какво да очаквате на Копривщица 2026"
  - „Фестивали по региони: Родопи, Стара планина, Странджа"
- [ ] Internal linking blog → festival detail pages
- [ ] Backlink стратегия: туристически портали, общински сайтове, фолклорни асоциации

### Barter с микро-influencers (вместо плащане)

- [ ] Списък с 10–15 микро-influencers (5k–50k followers) в travel/lifestyle BG
- [ ] Pitch: VIP акаунт завинаги + featured listing на любимия им фестивал + affiliate комисионни (когато имаме Booking.com)

### PR (месец 2)

- [ ] Pitch към Capital, Webcafe, Manager.bg — story angle: „Млад български инженер строи Spotify за фестивали"
- [ ] Подкаст pitches — Bulgarian Tech Podcast, Дигитализирай.се

---

## 📊 KPIs (първи 30 дни след launch)

| Метрика | Цел | Source |
|---|---|---|
| Unique visitors | 3000–5000 | Plausible |
| Регистрации | 100–200 | Supabase |
| Festivals added to plan | 500+ | Supabase |
| Email subscribers | 200+ | Resend audience |
| Bounce rate | < 60% | Plausible |
| Avg session duration | > 2 мин | Plausible |
| Conversion to plan | > 15% от visitors | Custom event |
| CAC от paid | < 2 лв./signup | Meta + Google reports |
| Sentry error rate | < 1% от sessions | Sentry |

### Daily routine (15 мин/ден)

- [ ] Sentry — нови грешки?
- [ ] Plausible — трафик, top pages, top sources?
- [ ] Meta Ads Manager (след ден 21) — CPC, CTR, conversions?
- [ ] Supabase — нови регистрации, активност?
- [ ] Email inbox — feedback, organizer запитвания?

---

## ⏳ Отложено (за след launch)

| Item | Кога |
|---|---|
| Blog секция и SEO статии | Месец 2 |
| Meta Ads start | Ден 21+ |
| Google Ads start | Ден 30+ |
| Influencer outreach | Ден 21+ |
| PR pitch към медии | Месец 2 |
| Mobile app launch | Месец 2-3 |
| Booking.com affiliate | Месец 2 |
| VRBO / Travelpayouts | Месец 2 |
| VIP packages за организатори | Месец 2 |
| Press release | Месец 2 |
| TikTok съдържание | Месец 2 |
| Партньорства с общини | Месец 3 |

---

## 🤖 Инструкции за Claude Code

> Този раздел е специално за Claude Code. Чети го преди да започнеш работа.

### Правила за поддръжка на този файл

1. **Винаги чети този файл преди да започнеш task свързан с launch.** Това е source of truth.
2. **След като завършиш задача — обнови съответната кутийка** от `- [ ]` на `- [x]`.
3. **Когато започнеш задача — маркирай я с `- [~]`** (in progress).
4. **Когато си блокиран — маркирай с `- [!]`** и добави бележка под линия защо.
5. **Обнови `Sprint ден` и `Последно обновяване`** в горната секция при всяка сесия.
6. **Не променяй структурата на файла** без изрично потвърждение от Експерта.
7. **Когато добавяш бележки от твоя страна**, използвай `> 💡 Claude Code note:` блок.

### Когато completes-ваш задача

```markdown
- [x] **Sentry** setup — `npm i @sentry/nextjs && npx @sentry/wizard`
> 💡 Claude Code note (18 май): Инсталиран `@sentry/nextjs@9.x`. Конфигурация в `sentry.client.config.ts` и `sentry.server.config.ts`. DSN в `SENTRY_DSN` env var. Slack webhook за critical alerts добавен.
```

### Когато попаднеш на блокер

```markdown
- [!] DKIM запис в DNS на festivo.bg
> ⚠️ Claude Code blocker (19 май): Нямам достъп до DNS dashboard на регистратора. Експерта трябва да добави CNAME записите от Resend dashboard ръчно.
```

### Status легенда

- `[ ]` Todo
- `[x]` Done
- `[~]` In progress
- `[!]` Blocked

### Препоръчителни референции

- `PROJECT_CONTEXT.md` — общ контекст
- `AI_CONTEXT.md` — AI-specific указания
- `AI_DEVELOPER_RULES.md` — coding standards
- `AI_SYSTEM_ARCHITECT.md` — архитектурни решения
- `docs/database-schema.md`, `docs/system-architecture.md`

---

## 🔥 Топ 5 неща преди всичко друго

1. **Sentry + Plausible + Meta Pixel** — ден 1, без отлагане
2. **DKIM/SPF/DMARC** — ден 5, защото DNS propagation отнема време
3. **OG картинка homepage** — без това всеки споделен линк изглежда зле
4. **Schema.org Event JSON-LD** — без това няма Google rich results
5. **Lighthouse fix-ове** — без 90+ Google няма да ранкира

---

_Last updated: 19 май 2026 от Claude Code_
