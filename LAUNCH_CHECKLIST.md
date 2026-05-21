# 🚀 Festivo.bg — Launch Checklist

> **Living document.** Този файл е source of truth за launch процеса. Claude Code и Експерта го обновяват всеки път, когато статус се промени.

**Слоган:** Открий. Планирай. Посети. — Фестивалите на България на едно място.
**Target launch date:** Сряда, 28 май 2026 (ден 14 от sprint-а)
**Бюджет реклама:** до 200 лв./месец (стартира ден 21+)

---

## 📍 Текущ статус

- **Sprint ден:** 7 / 14
- **Launch стабилност:** 🟡 в подготовка
- **Блокери в момента:** Umami beacon не пристига от incognito браузър (probable tracker-blocker; ще се верифицира от normal browser); Railway email cron deploy чака peak-hours да приключат (след 21:00 София).
- **Последно обновяване:** 21 май 2026 (сутрин)
- **Прогрес:** 50 ✅ / 89 ⏳
- **Свършено на 20 май (вечер):**
  - 404 + Error + Festival detail loading страници (PR #336)
  - Build cleanup — `npm run build`, `tsc --noEmit`, `next lint` всички clean (PR #337)
  - Премахнат broken `app/api/debug/test-auth` route
  - Sentry deprecations премахнати (`disableLogger`, `automaticVercelMonitors` → `webpack.{treeshake.removeDebugLogging, automaticVercelMonitors}`)
  - Image optimization в `FestivalMedia` (PR #338) — gallery thumbnails вече lazy-load
  - Условия за организатори `/terms-organizers` (PR #339) — 15 секции, добавен в footer
  - Newsletter signup форма в footer (PR #340) — Supabase storage, Turnstile + honeypot
  - `.claude/settings.json` с read-only command allowlist (PR #335)
- **🚨 Преди следващ деплой:** Run миграция `scripts/sql/20260520_newsletter_subscribers.sql` в Supabase Dashboard → newsletter formата ще работи
- **Ден 5 остава (на друг комп):** Email confirmation темплейт паста в Supabase Dashboard (HTML вече готов в `docs/email-templates/supabase-confirmation.html`), env vars review във Vercel (ръчно).
- **Следва (Ден 7+):** Lighthouse audit + fix, font optimization, favicons, cross-browser test, Supabase backups, launch комуникация drafts (Reddit/HN/LinkedIn/FB), email шаблон към 50 организатора, 10 FB групи списък.

### 🔄 PENDING VERIFICATION

- **Newsletter table:** Migration `20260520_newsletter_subscribers.sql` чака да се run-не в Supabase Dashboard. Без нея — footer формата ще връща 502 при submit.
- **Email cron** (Railway service `festivo-email-cron`): create-нат с правилни variables; deploy блокиран до 21:00 София (free-tier peak hours). Очаквай welcome email за `tsanislav.tsankov1@gmail.com` да мине от `pending` към `sent`.
- **Umami pageviews:** скриптът зарежда (script.js status 200, `data-website-id` в DOM), GTM зарежда — но beacon `/api/send` не пристига от incognito browser. Тестване: отвори festivo.bg в нормален Chrome → обнови `cloud.umami.is` → Realtime трябва да покаже visitor.
- **GA4:** Realtime data появява ~30-60 сек след analytics consent в cookie banner-а.

### 📦 Merged PRs от тази сесия (20-21 май)

| PR | Title | Status |
|---|---|---|
| #334 | feat(seo): dynamic homepage OG image | ✅ Merged |
| #335 | chore(claude): read-only command allowlist | ✅ Merged |
| #336 | feat(ui): styled 404, error, festival loading | ✅ Merged |
| #337 | chore(build): clean build + Sentry deprecations | ✅ Merged |
| #338 | perf(festival): optimize gallery images | ✅ Merged |
| #339 | feat(legal): organizer-specific terms page | ✅ Merged |
| #340 | feat(newsletter): footer email signup → Supabase | ✅ Merged (миграция предстои) |

---

## 🗓 14-дневен Launch Sprint

### Седмица 1 — Технически блокери (дни 1–7)

#### Ден 1–2: Мониторинг + Pixel (НАЙ-ВАЖНОТО)

- [x] **Sentry** setup — `npm i @sentry/nextjs && npx @sentry/wizard`
> 💡 Claude Code note (18 май): Инсталиран `@sentry/nextjs`. Wizard + Vercel integration минаха успешно. DSN в env vars. Конфигурирано: `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0.0`, `replaysOnErrorSampleRate: 1.0`, `sendDefaultPii: false` (GDPR). `generateMetadata()` в `app/layout.tsx` включва `Sentry.getTraceData()` за distributed tracing.
- [x] **Plausible** или **Umami** instalation — script tag в `layout.tsx`
> 💡 Claude Code note (20 май): Избран Umami Cloud (free tier, GDPR-friendly без cookies). `components/UmamiAnalytics.tsx` зарежда script-а без consent gate. Чака се регистрация в Umami Cloud + `NEXT_PUBLIC_UMAMI_WEBSITE_ID` env var във Vercel.
- [x] **Meta Pixel** инсталиран — започва да събира data веднага
> 💡 Claude Code note (18 май): Pixel ID `1381183357170093`. `MetaPixel` компонент с `next/script strategy=afterInteractive`. Env var `NEXT_PUBLIC_META_PIXEL_ID` добавен в Vercel.
- [x] **GA4** + Google Tag Manager — за по-късно Google Ads
> 💡 Claude Code note (20 май): `components/GoogleAnalytics.tsx` зарежда GTM ако `NEXT_PUBLIC_GTM_ID` е set (предпочитан вариант — GTM е централна точка за всички pixels). Иначе fallback на директно gtag.js с `NEXT_PUBLIC_GA4_MEASUREMENT_ID`. Cookie-based → gated зад `ConsentGatedAnalytics`. Чака се регистрация в GA4 + GTM + env vars във Vercel.
- [x] **UptimeRobot** — добави festivo.bg homepage + `/api/health`
> 💡 Claude Code note (19 май): Monitor добавен на dashboard.uptimerobot.com — HTTP/S, festivo.bg, на всеки 5 мин. `/api/health` edge endpoint добавен (PR #318).
- [x] **Vercel Analytics** включен от dashboard
- [x] **Slack/Discord webhook** за критични Sentry alerts
> 💡 Claude Code note (19 май): Email alert настроен в Sentry — "A new issue is created" → Notify Suggested Assignees. Вече има и default "high priority" alert.

> ⏰ Защо първо това: мониторингът трябва да върви ПРЕДИ да има потребители. Pixel-ът има нужда от 14 дни data — стартирай го веднага.

#### Ден 3–4: SEO + Social meta

- [x] `robots.txt` в `/public/robots.txt`
- [x] `sitemap.xml` — автоматично през `app/sitemap.ts`
- [x] Уникален `<title>` и `meta description` на всяка route (home, /festivals, /calendar, /map, /за-организатори, [slug])
- [x] `canonical` URL на всяка страница
- [x] `lang="bg"` на `<html>`
- [x] **Schema.org `Event` JSON-LD** на festival detail (критично за Google rich results)
- [x] **Schema.org `Organization`** на homepage
- [x] OG картинка за homepage (1200×630) — динамична през `app/opengraph-image.tsx`
> 💡 Claude Code note (20 май): Вместо ръчна картинка в Canva — създадена динамична OG чрез Next.js `ImageResponse` (edge runtime). Дизайн в стила на Festivo: dark background, accent #d97706, slogan „Открий. Планирай. Посети.", 3 feature chips. Махнати ръчните `og-home.jpg` референции от `app/page.tsx` — Next.js auto-injects route-level OG.
- [x] Динамичен OG за festival страници (`opengraph-image.tsx`)
- [x] `og:title`, `og:description`, `og:image`, `og:url`, `og:type` на всяка страница
- [x] Twitter Card (`twitter:card="summary_large_image"`)
- [ ] Favicons — пълен сет (16, 32, 180, 512) през realfavicongenerator.net
- [x] `manifest.json` с цветове `#7c2d12`, `#f6f5f1`
> 💡 Claude Code note (19 май): robots.txt, sitemap, OG тагове, JSON-LD, manifest добавени в PR #319. OG image за homepage предстои (нужен ръчен дизайн 1200×630).
- [x] Регистрация в **Google Search Console** + submit sitemap
> 💡 Claude Code note (19 май): Верифициран домейн. Sitemap submitted — статус "Processing" (24-48ч).
- [x] Регистрация в **Bing Webmaster Tools**
> 💡 Claude Code note (19 май): Импортиран от Google Search Console. Sitemap submitted — Processing.
- [ ] Тест с https://www.opengraph.xyz/

#### Ден 5: Email + сигурност

- [x] **DKIM** запис в DNS на festivo.bg (от Resend dashboard)
- [x] **SPF** запис в DNS
- [x] **DMARC** запис в DNS (поне `v=DMARC1; p=none`)
> 💡 Claude Code note (19 май): DKIM + SPF вече бяха в Cloudflare (Resend verified). DMARC добавен като `TXT _dmarc v=DMARC1; p=none`. След 2-3 седмици смени на `p=quarantine`.
- [x] Тест в https://www.mail-tester.com/ → цел 9/10+
> 💡 Claude Code note (19 май): Резултат 9/10. -1 за DMARC p=none (нормално за старт). SPF, DKIM, не сме в блокиращи списъци — всичко зелено.
- [x] Welcome email шаблон
> 💡 Claude Code note (20 май): Темплейтът дойде от PR #330 (другия компютър) — `WelcomeEmail.tsx` + registry/schemas. PR #331 добави enqueue логиката: DB trigger `trg_enqueue_welcome_email` (миграция `20260519_welcome_email_on_user_insert.sql`) на INSERT в `public.users`, idempotent с `welcome:<userId>` dedupe. Шаблонът сега приема `unsubscribeUrl` + `managePreferencesUrl`, които се резолват автоматично от `renderEmailJob` чрез `resolveOptionalEmailLinks`.
- [x] Password reset шаблон
- [ ] Email confirmation шаблон — HTML темплейтът е готов в `docs/email-templates/supabase-confirmation.html` (PR #330). Остава: копирай в Supabase Dashboard → Auth → Email Templates → "Confirm signup".
- [x] Unsubscribe линк във всички marketing имейли
> 💡 Claude Code note (19 май): Reminder имейлите вече имаха unsubscribe. Welcome го получи чрез нов `lib/email/resolveOptionalEmailLinks.ts` + `renderEmailJob` enrichment. `OPTIONAL_LINK_TYPES` set позволява лесно разширяване и за други marketing типове (напр. бъдещ newsletter).
- [x] **Supabase RLS** audit на всички таблици
> 💡 Claude Code note (19 май): Audit чрез `scripts/sql/audit_rls.sql`. Намерени: 9 таблици без RLS (admin/internal) + 1 overpermissive policy на `organizers`. Fix-нати с миграции `20260519_enable_rls_admin_internal_tables.sql` и `20260519_drop_organizers_public_read_overpermissive.sql`. Set 1 (NO RLS) сега е празен. Остава post-launch: `festival_likes` privacy check + duplicate SELECT policies consolidation.
- [x] **CSP headers** в `next.config.js`
- [x] `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
> 💡 Claude Code note (19 май): CSP + Permissions-Policy добавени в PR #321. securityheaders.com → Grade A. Всички 6 headers зелени.
- [ ] Всички production env vars в Vercel (нищо в git)
- [x] Тест в https://securityheaders.com/ → цел A grade
- [x] **CORS** на `/api/mobile/*` — само за production app domain
> 💡 Claude Code note (19 май): `lib/mobileApiGuard.ts` + middleware integration. Native React Native (без Origin header) → allow. Browser cross-origin → 403. Allowlist чрез `MOBILE_API_ALLOWED_ORIGINS` env (празно в prod, dev само за Expo web). OPTIONS preflight handled.
- [x] Rate limiting на public endpoints (Upstash)
> 💡 Claude Code note (19 май): Mobile API сега има buckets `mobile-read: 120 req/60s` (GET) и `mobile-write: 30 req/60s`. Middleware ги прилага и за GET (anti-scraping). Останалите public endpoints вече ползваха buckets (`user-actions`, `auth`, `api-post`).

#### Ден 6–7: Lighthouse + полиране

- [ ] Lighthouse audit на 5 ключови страници (mobile-first): 90+ на Performance, Accessibility, SEO, Best Practices
- [x] Image optimization (всички с `next/image`, `alt`, lazy loading)
> 💡 Claude Code note (20 май): Audit на 12 `<img>` тага в 7 файла. Конвертирани 3 в `FestivalMedia.tsx` (gallery main + thumbnails + YouTube thumbs) към `FallbackImage` с lazy loading и responsive `sizes` prop (PR #338). Hero, Meta Pixel noscript, lightbox и admin форми — обосновано оставени (explicit eslint-disable + LCP-critical с eager loading).
- [ ] Font loading optimization
- [ ] Unused JS / CSS removal
- [x] `404.tsx` и `error.tsx` стилизирани
> 💡 Claude Code note (20 май): Branded 404 (`app/not-found.tsx`), error boundary (`app/error.tsx`) с Sentry capture и festival-specific 404 (`app/festivals/[slug]/not-found.tsx`) — всички с accent bar #7c2d12, Festivo brand стил, CTAs към home + festivals, `robots: noindex` (PR #336).
- [x] Loading states (`loading.tsx`) на всички routes
> 💡 Claude Code note (20 май): Festival detail skeleton (`app/festivals/[slug]/loading.tsx`) добавен в PR #336. Останалите ключови routes (festivals, calendar, map) вече имаха.
- [ ] Cross-browser тест: Chrome, Safari iOS, Firefox, Edge
- [ ] Real mobile тест на iPhone + Android
- [x] `npm run build` без warnings
> 💡 Claude Code note (20 май): Премахнат broken debug route `app/api/debug/test-auth` (имаше `PASTE_REAL_TOKEN_HERE` hardcode). Sentry deprecations fix-нати (PR #337). Build clean.
- [x] `tsc --noEmit` без errors
- [x] ESLint clean
- [x] Health check endpoint `/api/health`
- [ ] **Supabase backups** включени (Pro план — point-in-time recovery)

---

### 📱 Mobile touchpoints (паралелно с уеб sprint-а)

> ⏰ **Стратегия:** мобилното приложение НЕ launch-ва на 28 май заедно със сайта. App Store / Play review е 3–7 дни и непредвидим — bind-ването на двата launch-а е риск. Submit в stores ден 14–15, публичен mobile launch ден 21+ заедно с paid ads. Този секция покрива само touchpoint-ите от страна на уеб сайта.

#### На сайта (преди web launch)

- [x] **CORS на `/api/mobile/*`** — само за production app domain (вече в Ден 5)
- [x] **Rate limiting** на mobile endpoints (вече в Ден 5)
- [ ] Load test на mobile API endpoints (k6 или Artillery, baseline за prod traffic)
- [ ] **Deep links / Universal Links:**
  - [ ] `public/.well-known/apple-app-site-association` (iOS)
  - [ ] `public/.well-known/assetlinks.json` (Android)
  - [ ] Тест с https://branch.io/resources/aasa-validator/
- [ ] **"Изтегли приложението"** CTA в footer + smart app banner (само когато mobile app е в stores)
- [ ] OG / meta тагове да съдържат `al:ios:url` и `al:android:url` за app-linking
- [ ] Privacy policy + Terms покриват и мобилното (един документ за двете платформи)

#### Mobile app (отделен mini-sprint, ден 14–21)

- [ ] App Store Connect listing — screenshots, описание, ключови думи (BG + EN)
- [ ] Google Play Console listing — screenshots, описание (BG + EN)
- [ ] App icons финални (1024×1024 + adaptive)
- [ ] Privacy nutrition labels (App Store) + Data Safety (Play)
- [ ] TestFlight beta с 10–15 души (паралелно със soft launch на уеб)
- [ ] Sentry за React Native инсталиран
- [ ] Submit за review (цел: ден 14–15)
- [ ] Push notification credentials (APNs + FCM) в production

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
- [x] Условия за организатори (отделна страница)
> 💡 Claude Code note (20 май): `/terms-organizers` страница, 15 секции — кой може да бъде организатор, claim/approval flow, изисквания към съдържанието, права (organizer запазва, дава неизкл. лиценз), VIP план + promotion credits, refund policy, прекратяване, БГ юрисдикция (PR #339). Link в footer-а под „Условия за организатори". ⚠️ Препоръчителен правен преглед преди launch.
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
- [~] Newsletter signup форма (footer + popup след 30 сек)
> 💡 Claude Code note (20 май, вечер): Footer форма готова (PR #340). Storage: Supabase `newsletter_subscribers` (source of truth, RLS deny anon/auth). API: `POST /api/newsletter/subscribe` с Turnstile + honeypot + idempotent upsert. Component готов и за popup/landing (`source` prop). **🚨 Преди формата да работи в production — run миграция `scripts/sql/20260520_newsletter_subscribers.sql` в Supabase Dashboard.** Popup след 30s остава.

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
- [x] Meta Pixel инсталиран (ден 1)
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

_Last updated: 21 май 2026 от Claude Code_
