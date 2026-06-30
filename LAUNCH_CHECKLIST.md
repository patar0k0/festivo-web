# 🚀 Festivo.bg — Launch Checklist

> **Living document.** Този файл е source of truth за launch процеса. Claude Code и Експерта го обновяват всеки път, когато статус се промени.

**Слоган:** Открий. Планирай. Посети. — Фестивалите на България на едно място.
**Target launch date:** Сряда, 28 май 2026 (ден 14 от sprint-а)
**Бюджет реклама:** до 200 лв./месец (стартира ден 21+)

---

## 📍 Текущ статус

- **Sprint ден:** 14 / 14 — 🚀 LAUNCHED
- **Launch стабилност:** 🟢 сайтът е публично качен
- **Блокери в момента:** няма
- **Последно обновяване:** 30 юни 2026
- **Прогрес:** ~71 ✅ / 85 — остатъкът е post-launch backlog
- **Следва:** post-launch — съдържание, social media, Lighthouse audit, soft launch с близки.

> 💡 Claude Code note (23 юни): Post-launch bug fix извън sprint backlog-а — пълен audit на date/timezone обработката в проекта; поправени реални Europe/Sofia bug-ове (EventCard badge/urgency tags, admin таблици, cancellation имейли) — [PR #641](https://github.com/patar0k0/festivo-web/pull/641).

### 📌 Organizer submissions — Pro UX (завършено 26 май)

- [x] **Pro UX за `/organizer/submissions`** — следваща страница в organizer redesign sprint-а. Pattern: header card + sticky info sidebar + status badges + relative dates (като /organizer/dashboard). Reference: PRs #372-#378 за подобни pages.
> 💡 Claude Code note (26 май): Имплементирано — header card с gradient, stats bar (4 StatChip компонента), status badges с dot-индикатор, relative dates (date-fns/bg), empty state, action buttons контекстни по статус, success banner при ?submitted=1. Беше направено но чеклистът не беше обновен.

### Свършено на 22 май 2026 (Ден 7 — 13 PRs + infrastructure)

**Lighthouse / a11y polish:**
- Calendar contrast + Label-in-Name fixes (PR #355)
- POST handler на `/api/jobs/email` — Railway worker crash fix (PR #356)

**Email surface (брандиран confirmation flow + админ@):**
- Refined confirmation email design (PR #357)
- Brand slogan „Открий. Планирай. Посети." в всички email headers (PR #358)
- Effective dates 28 май 2026 + signup implicit consent (PR #361)
- Unified contact addresses → `admin@festivo.bg` (PR #363)

**Legal compliance:**
- Третите страни в /privacy §4 + /cookies (Meta, GA4, Umami, Sentry, Cloudflare) (PR #362)
- Unescaped quote fix който блокираше Vercel build (PR #365)

**Admin tools:**
- Hard delete достъпен в production с double confirmation (PR #359)
- Phantom tables не блокират hard delete (PR #360)
- Admin festivals — default sort start_date ASC + Sort dropdown (PR #367)

**Security:**
- Debug endpoints gated в production (PR #366)
- Full security audit — A-grade headers, no leaked secrets, no critical vulns

**Docs:**
- `docs/launch-flip-procedure.md` runbook за launch ден (PR #364)

**Infrastructure (off-code):**
- ✅ Cloudflare Email Routing — catch-all `*@festivo.bg` → твоя Gmail
- ✅ Gmail "Send mail as" с Resend SMTP — изпращане от `admin@festivo.bg`
- ✅ Supabase auth e-mails минават през Resend SMTP (no rate limits)

### Свършено на 20-21 май (предишни сесии)

- 404 + Error + Festival detail loading страници (PR #336)
- Build cleanup — `npm run build`, `tsc --noEmit`, `next lint` всички clean (PR #337)
- Image optimization в `FestivalMedia` (PR #338)
- Условия за организатори `/terms-organizers` (PR #339) — 15 секции
- Newsletter signup форма в footer (PR #340) + production миграция приложена
- Sentry deprecations премахнати

### 📦 Merged PRs от стартирането на sprint-а

| PR | Title | Status |
|---|---|---|
| #334 | feat(seo): dynamic homepage OG image | ✅ Merged |
| #335 | chore(claude): read-only command allowlist | ✅ Merged |
| #336 | feat(ui): styled 404, error, festival loading | ✅ Merged |
| #337 | chore(build): clean build + Sentry deprecations | ✅ Merged |
| #338 | perf(festival): optimize gallery images | ✅ Merged |
| #339 | feat(legal): organizer-specific terms page | ✅ Merged |
| #340 | feat(newsletter): footer email signup → Supabase | ✅ Merged + миграция |
| #342 | fix(legal): unblock Vercel deploy (ESLint quotes) | ✅ Merged |
| #355 | a11y(calendar): WCAG AA contrast + Label in Name | ✅ Merged |
| #356 | fix(jobs): accept POST on /api/jobs/email | ✅ Merged |
| #357 | polish(email): refine Supabase confirmation template | ✅ Merged |
| #358 | polish(email): brand slogan в email headers | ✅ Merged |
| #359 | fix(admin/users): enable hard delete в production | ✅ Merged |
| #360 | fix(admin/users): hard delete tolerates phantom tables | ✅ Merged |
| #361 | chore(legal): signup consent + effective dates | ✅ Merged |
| #362 | chore(legal): all active third-party processors | ✅ Merged |
| #363 | chore(contact): unify to admin@festivo.bg | ✅ Merged |
| #364 | docs: launch flip procedure runbook | ✅ Merged |
| #365 | fix(signup): escape Bulgarian quote (Vercel build) | ✅ Merged |
| #366 | security: gate debug routes в production | ✅ Merged |
| #367 | polish(admin/festivals): default sort + Sort dropdown | ✅ Merged |

---

## 🔮 Post-launch backlog (след 28 май)

Списък на полиращи задачи отложени за след launch — за да не правим рискови промени в последните дни преди публикуване.

### Festival lifecycle management
- [x] **Festival cancellation flow** — admin + organizer (owner) cancel, plan user emails, public banner + badge, Schema.org EventCancelled, skip reminders (feat/festival-cancellation)

### Admin tools polish
- [ ] **Sortable column headers** в `/admin/festivals` (click на колона → sort, ▲▼ indicator)
- [ ] **Visual grouping by status** — divider секции "Pending review", "Upcoming", "Ongoing", "Past"
- [ ] **Quick filter chips** — „Този weekend", „Pending review", „Без снимки", „VIP"
- [ ] **Bold за edited recently** (< 7 дни) — subtle visual cue
- [ ] **Badge „❗ No content"** за фестивали без описание/снимки
- [ ] **Row hover preview** със снимка + описание
- [ ] Same pattern в `/admin/users`, `/admin/organizers`, `/admin/pending-festivals`

### Security hardening
- [ ] CSP nonces — премахни `'unsafe-inline'` за scripts
- [ ] Penetration test (3rd party security pro)
- [ ] Bug bounty на HackerOne / Bugcrowd
- [ ] Cloudflare WAF rules
- [ ] Periodic `npm audit` (monthly cadence)
- [ ] Secrets rotation policy (6-month cycle)

### Legal & UX gaps
- [ ] Add `privacy@festivo.bg` алиас explicit в /privacy (catch-all вече го хваща)
- [ ] /privacy — Children's data (GDPR Art. 8) + Automated decision-making (Art. 22)
- [ ] /terms — Force majeure + indemnification + DSA notice-and-action
- [ ] Конкретни cookie names + durations в /cookies (gold standard)
- [ ] /terms-organizers — payment terms (методи, ДДС, фактуриране) при стартиране на paid plans
- [ ] Add legal entity info в /privacy (EOOD име + EIK + регистриран адрес) — GDPR Art. 13 mandate

### Performance
- [ ] Font loading optimization (`display: swap`, preload)
- [ ] Unused JS / CSS removal
- [x] Lighthouse audit + fix за `/signup`, `/login`, `/festival-detail`
> 💡 Claude Code note (30 юни): Mobile audit (homepage + 3-те страници) намери и оправи: Umami CSP bug (`gateway.umami.is` липсваше от `connect-src` — analytics-ът не записваше нищо), Sentry Session Replay сваляне (-19% shared JS, PR #671), FallbackImage quality 72→60 (-11% per image, PR #672). Homepage Performance 57→66, Best Practices 92→100. Festival detail (`/festivals/[slug]`) остава най-тежка (Performance 51, LCP 10s) заради interactive Google Maps embed (~308KB) — съзнателно оставено непипнато (продуктово решение, не bug). Signup Turnstile (~380KB) също оставено — нужно за anti-bot защита.
- [x] Favicons full set (16/32/180/512) — дублиращ запис; генерирани с sharp от brand SVG (PR #435, ден 3-4)

### Operational
- [x] Supabase backups — GitHub Actions → Cloudflare R2 daily pg_dump (PR #505, активен от 2 юни 2026; cron 03:00 UTC, 30-day retention в bucket `festivo-db-backups`)
- [ ] Cross-browser test (Chrome, Safari iOS, Firefox, Edge)
- [ ] Real mobile test (iPhone + Android)
- [ ] Newsletter sending strategy — Resend Audiences + Broadcasts setup
- [ ] DPA преглед със Supabase, Resend, Upstash
- [ ] Supabase Auth Hook — route confirmation/magic-link emails през email_jobs за unified admin view

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
- [x] Favicons — пълен сет (16, 32, 180, 192, 512px PNG + apple-touch-icon + SVG)
> 💡 Claude Code note (26 май): Генерирани с sharp от brand SVG. PR #435. Manifest обновен с 192/512 за PWA. layout.tsx — explicit icon tags.
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
- [x] Email confirmation шаблон — paste-нат в Supabase Dashboard, тестван end-to-end. Polished design + brand slogan + admin@ contact (PR #357, #358, #363).
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

- [~] Lighthouse audit на 5 ключови страници (mobile-first): 90+ на Performance, Accessibility, SEO, Best Practices
> ⚠️ Трябва да се пусне срещу production (festivo.bg) — не може локално (Supabase env). Ползвай PageSpeed Insights: https://pagespeed.web.dev/
> 💡 Claude Code note (31 май): Homepage резултат: Accessibility 96, Best Practices 100, SEO 100, Performance 84. LCP 4.0s (червено) — root cause: некеширани DB заявки + Vercel image optimizer cold miss. PR #480: unstable_cache (5 мин) за 7-те homepage заявки + AVIF формат. Очаквано подобрение: FCP ~1.5s, LCP ~3.0-3.5s, Performance ~88-90.
- [x] Image optimization (всички с `next/image`, `alt`, lazy loading)
> 💡 Claude Code note (20 май): Audit на 12 `<img>` тага в 7 файла. Конвертирани 3 в `FestivalMedia.tsx` (gallery main + thumbnails + YouTube thumbs) към `FallbackImage` с lazy loading и responsive `sizes` prop (PR #338). Hero, Meta Pixel noscript, lightbox и admin форми — обосновано оставени (explicit eslint-disable + LCP-critical с eager loading).
- [x] Font loading optimization
> 💡 Claude Code note (26 май): `display: "optional"` за Fraunces (декоративен heading шрифт — не блокира рендер), `display: "swap"` (default) за Manrope (основен body шрифт). PR #438. Cormorant Garamond — само weight 700 (минимален bundle).
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

- [x] Покрий 50+ верифицирани фестивала за 2026 (текущо 65 — добре)
- [x] Поне 10 фестивала с богато съдържание (програма, дълго описание, множество снимки)
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

- [x] **Facebook страница Festivo.bg** — cover, bio, първи 3 поста
- [~] **Instagram @festivo.bg** — bio, линк, първи 3 поста
> 💡 Status (21 май): Profile създаден, нивото на оптимизация неясно. Остава: bio с „Открий. Планирай. Посети.", линк към festivo.bg, profile picture, highlight covers, първи 3 поста.
- [ ] **LinkedIn** страница (B2B аудитория)
- [~] Резервирай @festivo.bg в TikTok (без постване)
> 💡 Status (21 май): Handle резервиран, profile-ът евентуално не е попълнен. За launch достатъчно (TikTok съдържание планирано за месец 2).
- [ ] Cover photos и bios със слогана „Открий. Планирай. Посети."
- [ ] Линк към festivo.bg във всеки профил

#### Ден 11–12: Soft launch (тих)

- [ ] Сподели сайта с **10–15 близки** (приятели, семейство, познати фестивалджии)
- [ ] **Google Form** или Typeform за feedback (5 въпроса максимум)
- [ ] Дай им **VIP early adopter access** (3 месеца безплатно)
- [ ] **Daily Sentry check** — fix всички errors в рамките на 24h
- [ ] Поправи топ 3 UX проблема от feedback
- [~] Newsletter signup форма (footer + popup след 30 сек)
> 💡 Claude Code note (20 май, вечер): Footer форма готова (PR #340). Storage: Supabase `newsletter_subscribers` (source of truth, RLS deny anon/auth). API: `POST /api/newsletter/subscribe` с honeypot + idempotent upsert. Component готов и за popup/landing (`source` prop). Popup след 30s остава.
> 💡 Claude Code note (21 май): Миграцията `scripts/sql/20260520_newsletter_subscribers.sql` приложена в production. Footer формата работи (test count = 1). Turnstile премахнат (PR #343) — clash с warm footer theme; останалата защита (honeypot + email regex + rate limit + DB unique) е достатъчна за low-stakes signup.

##### 📮 Newsletter sending strategy — РЕШЕНИЕ: Опция A (Resend Audiences)

**Защо A:** 15 мин setup vs 2-3 часа custom код. Built-in admin UI, open/click analytics, A/B testing на subjects. 3000 имейли/мес безплатно. Resend вече е инсталиран за transactional — DKIM/SPF/DMARC настроени.

**Stack:**
- Source of truth: Supabase `newsletter_subscribers` (винаги)
- Изпращащ канал: Resend **Audiences** + **Broadcasts**
- Sync: cron script който push-ва нови subscribers към Resend Audience през API
- Unsubscribe: Resend handle-ва native (one-click unsub link); локалния `unsubscribe_token` остава за бъдеще

**TODO (post-launch, ден 21+):**
- [ ] Създай Resend Audience `Festivo Newsletter` → копирай Audience ID
- [ ] Env var: `RESEND_NEWSLETTER_AUDIENCE_ID` във Vercel + Railway
- [ ] Скрипт `scripts/sync-newsletter-to-resend.mjs` — чете нови subscribers (`synced_to_resend_at IS NULL`), POST към Resend Audience contacts API, marks-ва timestamp
- [ ] Миграция: add column `synced_to_resend_at timestamptz` на `newsletter_subscribers`
- [ ] Railway cron service `festivo-newsletter-sync` — daily schedule `0 6 * * *` (06:00 UTC = 09:00 София)
- [ ] First newsletter (~12 юни): „Добре дошли в Festivo — топ фестивали за юли"
- [ ] React Email template `NewsletterBaseTemplate` (потенциално за бъдещ swap към Опция B)

**Кога да се местим към Опция B (custom email_jobs):** ако имаме 5000+ subscribers, или искаме персонализация по град/любими, или Resend цена надхвърли $20/мес.

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

> 💡 Claude Code note (23 юни): Сайтът е публично качен и стабилен (виж статуса горе). Кутийките по-долу проследяват еднократните launch-day промо действия — оставени са в текущото си състояние, защото изпълнението им не е потвърдено в чеклиста. Отметни ги ръчно според реално направеното.

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

- [x] Schema.org Event markup → Google Rich Results
> 💡 Claude Code note (26 май): Дублира ден 3-4 item. JSON-LD `Event` schema е в `app/festivals/[slug]/page.tsx`, `Organization` на homepage — вече направено.
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

## След launch — Analytics v2

V1 е admin-only badge на festival page-а (виж `docs/superpowers/specs/2026-05-29-festival-view-counter-design.md`). Когато трафикът се стабилизира, разширяваме до пълен dashboard:

- [ ] Admin таблица с фестивали: нова сортируема колона „Гледания (30д)".
- [ ] `/admin/analytics` страница: топ 10 фестивали по views, time-series графики, view → save → click-out conversion funnel.
- [ ] Materialized aggregate таблица `festival_daily_stats` (festival_id, date, views, saves, click_outs, shares) обновявана от cron worker → O(1) admin queries вместо `count(*)`.
- [ ] Source attribution: parse Referer → `google` / `direct` / `push` / `share` / `mobile`. Mapping helper или нова колона в `analytics_events`.
- [ ] Bot detection v2: rate limiting per IP в edge middleware + headless browser fingerprinting (Lighthouse, Chrome DevTools Protocol detection).
- [ ] Search query tracking: нов `search_query` event тип + админ панел „Какво търсят, какво не намираме".
- [ ] GDPR retention: 12 месеца raw `analytics_events`, по-стари → агрегирани в `festival_daily_stats` и raw rows изтрити (cron job).
- [ ] Public „social proof" badge: показваме view count и на нормални посетители (опционално — само за promoted фестивали или с over N views).
- [ ] Geo distribution: parse Cloudflare / Vercel headers (`x-vercel-ip-country`), агрегирано без съхранение на IP.

---

_Last updated: 23 юни 2026 от Claude Code_
