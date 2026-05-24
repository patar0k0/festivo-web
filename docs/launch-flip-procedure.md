# 🚀 Launch flip procedure

Точна последователност от стъпки за публичното пускане на festivo.bg на **28 май 2026, сряда**. Това е runbook-а — отвори го отделно на launch ден и марковай при изпълнение.

---

## Архитектура накратко

Coming-soon / live режимът се контролира **изцяло от един env var**: `FESTIVO_PUBLIC_MODE`.

| Стойност | Поведение |
|---|---|
| `coming-soon` | Homepage = `<ComingSoonPublic />`; всички други routes redirect → `/`; `robots.txt` Disallow `/`; празен sitemap; nav/footer скрити |
| **Не set, или нещо различно от `coming-soon`** | Full site live; SEO open; sitemap пълен |

Препратки в код: `app/page.tsx`, `middleware.ts`, `app/robots.ts`, `app/sitemap.ts`, `components/LayoutShell.tsx`.

**Bypass:** cookie `festivo_preview` позволява full достъп дори в coming-soon mode. Полезен за тестване на production преди launch.

---

## T-24h — Pre-flight checklist (ден 13, вторник вечер)

- [ ] `LAUNCH_CHECKLIST.md` — всички Седмица 1 items маркирани ✅
- [ ] Sentry — последни 24h без unhandled errors на production
- [ ] Railway crons — `festivo-email-cron`, `festivo-newsletter-sync`, `festivo-workers` всички `Last run succeeded`
- [ ] Supabase — backup-а на 7-day default (или manual `pg_dump` ако сте setup-нали R2)
- [ ] Resend — quota check (3000/мес free; на launch очаквай 50-200 confirmation + welcome)
- [ ] Vercel — последен deploy на main **green**, без warnings в Build Logs
- [ ] Cloudflare Email Routing — тестов email към `admin@festivo.bg` пристига
- [ ] Gmail "Send mail as" — изпращане от `admin@festivo.bg` работи
- [ ] Lighthouse mobile audit на homepage — Accessibility 100, Performance > 50
- [ ] Първите 3 поста за всеки социален канал — готови в draft
- [ ] 50-email organizer outreach списък — готов
- [ ] FB групи списък (10 групи) — готов с различни angles за всяка

---

## T-30min — Final smoke test на coming-soon mode (8:30, преди flip)

В **incognito** (без preview cookie), отвори:

| URL | Очаквано |
|---|---|
| `https://festivo.bg` | Coming-soon page-а с newsletter signup |
| `https://festivo.bg/festivals` | Redirect към `/` (coming-soon) |
| `https://festivo.bg/robots.txt` | `User-agent: *\nDisallow: /` |
| `https://festivo.bg/sitemap.xml` | Само 1 URL (homepage) |
| `https://festivo.bg/admin` | Login screen (allowlisted, не redirect) |

Ако всички 5 минават → green light за flip.

---

## T = 09:00 — Flip момента ⚡

### Стъпка 1: Премахни env var-а

1. https://vercel.com/patar0k0s-projects/festivo-web/settings/environment-variables
2. Намери реда `FESTIVO_PUBLIC_MODE`
3. **Edit** → или промени value на `live` (празна стойност също работи), или **Delete** реда
4. Save

### Стъпка 2: Trigger redeploy

1. Vercel ще покаже banner "Environment Variables changed — redeploy to apply"
2. Иди в **Deployments** tab
3. Намери последния production deploy
4. ⋮ меню → **Redeploy** → отметни **"Use existing Build Cache"** → **Redeploy**
5. ⏱ ~30-60 секунди

### Стъпка 3: Изчакай зеления статус

Production deploy → **Ready** ✅

---

## T+5min — Post-flip smoke test 🧪

В **incognito** (важно — без cache, без preview cookie):

| URL | Очаквано |
|---|---|
| `https://festivo.bg` | Full homepage с hero "Открий. Планирай. Посети." и фестивални cards |
| `https://festivo.bg/festivals` | Listing с 65+ фестивала, филтри, pagination |
| `https://festivo.bg/calendar` | Календарна grid с фестивални точки |
| `https://festivo.bg/map` | Leaflet карта с маркери |
| `https://festivo.bg/robots.txt` | `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/...` + `Sitemap:` line |
| `https://festivo.bg/sitemap.xml` | 70+ URLs |
| `https://festivo.bg/signup` | Signup form с consent text |
| `https://festivo.bg/privacy` | Privacy policy, **В сила от: 28 май 2026 г.** |

### Бърз DNS check (от терминал)

```bash
curl -sI https://festivo.bg/robots.txt | head -5
curl -s https://festivo.bg/robots.txt
```

Трябва да върне `200 OK` и съдържание което **НЕ започва с `Disallow: /`**.

---

## T+15min — External signals

- [ ] Submit нов sitemap в **Google Search Console**: `https://festivo.bg/sitemap.xml`
- [ ] Submit нов sitemap в **Bing Webmaster Tools**
- [ ] **UptimeRobot** — провери че homepage check minute-rate е "Up" (200)
- [ ] **Sentry** — observe нови sessions/errors в realtime (https://sentry.io)
- [ ] **Meta Pixel Helper** Chrome extension — отвори festivo.bg → виж че pixel-ът fire-ва PageView event

---

## Rollback procedure (ако нещо счупи)

Симптом: production показва грешка / празна страница / 500 / Sentry alerts се покачват.

### Бърз rollback (под 60 sec)

1. Vercel → Settings → Environment Variables
2. Set `FESTIVO_PUBLIC_MODE` = `coming-soon`
3. Save → Redeploy (Use existing Build Cache)
4. ~30 sec → festivo.bg обратно в coming-soon mode

### Алтернатива: Rollback to previous deployment

1. Vercel → Deployments
2. Намери последния знаещ green deploy (преди flip-а)
3. ⋮ меню → **Promote to Production**
4. ~10 sec — instant swap

Двата варианта са обратими — можеш да flip-неш отново когато оправиш проблема.

---

## Communication launch sequence (Ден 14 — 28 май)

⚠️ **НЕ публикувай в социалните преди да минат smoke tests-овете и след T+15min external signals.** Грешка тук = launch с broken сайт пред 100+ души.

| Час | Действие |
|---|---|
| 09:00 | Flip env var → Vercel redeploy |
| 09:15 | Smoke tests pass → external signals |
| 09:30 | Reddit r/bulgaria пост |
| 09:45 | LinkedIn личен пост + FB личен пост |
| 10:00 | Първи пост на FB страницата на Festivo.bg |
| 13:00 | Постове в 5 FB групи (различен angle всяка) |
| 13:30 | Instagram launch пост + story |
| 14:00 | Email кампания към 50 организатора |
| 18:00 | Hacker News Show HN (11:00 EST) |
| 18:30+ | Втори round engagement — отговори на коментари |

⚠️ **НЕ пускай Meta Ads днес.** Pixel-ът трябва още 7 дни data. Ads стартират Ден 21+.

---

## Post-launch (T+24h — 29 май)

- [ ] Sentry — review всички unhandled errors от launch ден, fix top 3
- [ ] Vercel Analytics — провери traffic spike, top URLs, най-голям drop-off
- [ ] Resend Dashboard — провери email delivery rate (target > 95%)
- [ ] Supabase — провери signup conversion (visitors → registered users)
- [ ] UptimeRobot — провери че нямаше downtime > 5 мин
- [ ] Google Search Console — провери че sitemap-а е accepted и започват impressions
- [ ] Feedback от soft launch users + launch ден коментари → приоритизирай top 3 UX issues

---

## Контакти при инцидент

- Vercel support: https://vercel.com/help (~24h response on Hobby)
- Supabase support: https://supabase.com/support (~48h on Free)
- Sentry: https://sentry.io — instant alerts (трябва Discord webhook configured)
- Cloudflare: https://dash.cloudflare.com/support
